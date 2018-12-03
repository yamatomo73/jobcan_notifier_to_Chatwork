/**
 * ■このプロジェクト
 *  ジョブカンの勤怠をChatworkに通知するためのGAS
 *
 * ■依存ライブラリ
 *  https://github.com/yamatomo73/JobcanAttendanceReader
 *　
 * ■動作に必要なスクリプトプロパティ
 *
 * JOBCAN_MOBILE_PAGE_URL: JOBCANのモバイルページのログインURL
 * NOTIFIER_CW_API_TOKEN: 勤怠を通知するChatworkアカウントのAPIトークン
 * NOTIFIER_CW_LOGIN_EMAIL: 勤怠を通知するChatworkアカウントのログインメールアドレス
 * NOTIFIER_CW_LOGIN_PASS: 勤怠を通知するChatworkアカウントのパスワード 
 * NOTIFY_ROOM_ID: 勤怠を通知するチャットルームID
 */ 

/*
 * ポーリングして勤怠ステータスを監視
 */
function observe() {
  var model = _getCurrentDateRecord();
  if (null === model) {
    // まだ記録がない
    return null;
  }
  Logger.log(model);
  
  var notify_history = _getCurrentDateHistory();
  var updated_history = null;
  if (null === notify_history) {
    updated_history = new AttendanceHistory(
      null,
      model,
      false,
      false,
      false
    );
  } else {
    updated_history = new AttendanceHistory(
      notify_history.getId(),
      model,
      notify_history.isStartNotified(),
      notify_history.isLeavingWorkNotified(),
      notify_history.isFinishNotified()
    );
  }
  
  // 通知する room_id
  var notify_room_id = PropertiesService.getScriptProperties().getProperty('NOTIFY_ROOM_ID');
  
  // 勤務規定オブジェクト
  var work_regulation = new JobcanAttendanceReader.WorkRegulation(8 * 60, 60);

  // 勤務開始通知
  if (updated_history.shouldStartNotify()) {
    // 通知
    updated_history = updated_history.startNotify();
    Logger.log('開始通知');
    var client = _getChatworkClient();
    client.sendMessage(
        {
          'self_unread': 1,
          'room_id': notify_room_id,
          'body': Utilities.formatString('[info][title]自動投稿[/title]%s 勤務開始しました。[/info]', Utilities.formatDate(updated_history.getStartTime(), 'Asia/Tokyo', 'HH:mm')),
        }
      );
  }
  
  if (updated_history.shouldLeavingWorkNotify(work_regulation)) {
    updated_history = updated_history.leavingWorkNotify();
    Logger.log('退勤予告通知');
    var client = _getChatworkClient();
    client.sendMessage(
        {
          'self_unread': 1,
          'room_id': notify_room_id,
          'body': Utilities.formatString('[info][title]自動投稿[/title]あと %s 分で退勤時間になります。作業のクロージングをはじめましょう。[/info]', work_regulation.remainingWorkTime(model)),
        }
      );
  }
  
  // 勤務終了通知
  if (updated_history.shouldFinishNotify()) {
    // 当月のすべての情報
    var attendance_records = new JobcanAttendanceReader.AttendanceRecords(work_regulation, _getCurrentMonthRecords());
    // 通知
    updated_history = updated_history.finishNotify();
    Logger.log('終了通知');
    var client = _getChatworkClient();
    client.sendMessage(
        {
          'self_unread': 1,
          'room_id': notify_room_id,
          'body': Utilities.formatString(
            '[info][title]自動投稿[/title]%s 勤務終了しました\n今日の残業時間: %s 分\n今月の残業時間: %s 時間[/info]', 
            Utilities.formatDate(updated_history.getEndTime(), 'Asia/Tokyo', 'HH:mm'),
            work_regulation.overTime(updated_history.getAttendanceRecord()),
            (attendance_records.overTime() / 60).toFixed(2)
          ),
        }
      );
  }
  Logger.log(updated_history.toRecord());
  _storeHistory(updated_history);
}

/*
 * 当月の勤怠履歴を再反映する
 * 打刻修正等の結果を勤怠情報通知履歴にとりこむため
 */
function resetMonthHistory() {
  var models = _getCurrentMonthRecords();
  var historyRepository = _getCurrentMonthHistoryRepository();
  for (var i = 0; i < models.length; i++) {
    var notify_history = _getAttendanceHistory(models[i].getDate());
    var updated_history = null;
    if (null === notify_history ) {
      updated_history = new AttendanceHistory(
        null,
        models[i],
        false,
        false,
        false);
    } else {
      updated_history = new AttendanceHistory(
        notify_history.getId(),
        models[i],
        notify_history.isStartNotified(), 
        notify_history.isLeavingWorkNotified(), 
        notify_history.isFinishNotified()
      );
    }
    //Logger.log(models[i].toArray());
    //Logger.log(updated_history.toRecord());
    historyRepository.store(updated_history);
  }
}

/*
 * 当月の勤怠情報を取得する
 */
function _getCurrentMonthRecords() {
  // モバイルマイページの専用URL
  var login_url = PropertiesService.getScriptProperties().getProperty('JOBCAN_MOBILE_PAGE_URL');
  var repository = new JobcanAttendanceReader.AttendanceRecordRepository({
    'login_url': login_url,
  });
  
  var now = new Date();
  var year = Utilities.formatDate(now, "JST", "yyyy");
  var month = Utilities.formatDate(now, "JST", "MM");
  return repository.find(year, month);
}

/*
 * 当日の勤怠情報を取得する
 */
function _getCurrentDateRecord() {
  var search_str = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMd');
  var models = _getCurrentMonthRecords();
  for (var i = 0; i < models.length; i++) {
    if (Utilities.formatDate(models[i].getDate(), 'Asia/Tokyo', 'yyyyMd') === search_str) {
      return models[i];
    }
  }
  return null;
}

/*
 * 当月の勤怠情報通知履歴リポジトリを取得する
 */
function _getCurrentMonthHistoryRepository() {
  var sheet_name = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMM');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet_name);
  return new AttendanceHistoryRepository(sheet);
}

/*
 * 指定した日付の勤怠情報通知履歴を取得する
 */
function _getAttendanceHistory(date) {
  var historyRepository = _getCurrentMonthHistoryRepository();
  return historyRepository.findByDate(date);
}

/*
 * 当日の勤怠情報通知履歴を取得する
 */
function _getCurrentDateHistory() {
  return _getAttendanceHistory(new Date());
}

/*
 * 当月の勤怠情報通知履歴を取得する
 */
function _getCurrentMonthHistories(date) {
  var historyRepository = _getCurrentMonthHistoryRepository();
  return historyRepository.findByMonth(date);
}

/*
 * 勤怠情報通知履歴を永続化する
 */
function _storeHistory(history) {
  var historyRepository = _getCurrentMonthHistoryRepository();
  historyRepository.store(history);
}

/*
 * chatwork クライアントと取得する
 */
function _getChatworkClient() {
  var notifier_chatwork_api_token = PropertiesService.getScriptProperties().getProperty('NOTIFIER_CW_API_TOKEN');
  var notifier_chatwork_email = PropertiesService.getScriptProperties().getProperty('NOTIFIER_CW_LOGIN_EMAIL');
  var notifier_chatwork_password = PropertiesService.getScriptProperties().getProperty('NOTIFIER_CW_LOGIN_PASS');
  return new ChatWorkClientEx.factory({
          'token': notifier_chatwork_api_token,
          'email': notifier_chatwork_email,
          'password': notifier_chatwork_password,
        });
}