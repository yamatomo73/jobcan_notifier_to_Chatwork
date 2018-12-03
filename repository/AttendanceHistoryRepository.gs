(function(global){
  var AttendanceHistoryRepository = (function() {
    
    /**
    * 勤怠履歴のリポジトリ
    *
    * @return {Sheet} sheet 履歴用シート
    */
    function AttendanceHistoryRepository(sheet)
    {
      // this.sheet = new Sheet();
      this.sheet = sheet;
    };
    
    /**
    * 最新の履歴を取得する
    */
    AttendanceHistoryRepository.prototype.lasthistory = function() {
      var last_row = this.sheet.getLastRow();
      if (last_row <= 1) {
        // まだなにもない　
        return null;
      }
      
      return this.findById(last_row);
    };
    
    /**
    * IDを指定してモデルを取得する
    */
    AttendanceHistoryRepository.prototype.findById = function(id) {
      var last_row = this.sheet.getLastRow();
      if (last_row <= 1) {
        // まだなにもない　
        return null;
      }
      if (last_row < id) {
        return null;
      }
      var records = this._getRecordRange(id).getValues();
      return this._toModel(id, records[0]);
    };

    /**
    * 日付を指定してモデルを取得する
    */
    AttendanceHistoryRepository.prototype.findByDate = function(date) {
      var last_row = this.sheet.getLastRow();
      if (last_row <= 1) {
        // まだなにもない　
        return null;
      }

      var search_str = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMd');
      // すべての date
      var date_list = this.sheet.getRange(2, 1, last_row - 1, 1).getValues();
      
      for (var i = 0; i < date_list.length; i++) {
        if (Utilities.formatDate(date_list[i][0], 'Asia/Tokyo', 'yyyyMd') === search_str) {
          return this.findById(i + 2);
          //return this.findById(i + 1);
        }
      }
      return null;
    };

    /**
    * 年月を指定してモデルリストを取得する
    */
    AttendanceHistoryRepository.prototype.findByMonth = function(date) {
      var last_row = this.sheet.getLastRow();
      if (last_row <= 1) {
        // まだなにもない　
        return [];
      }
      
      var result_list = [];
      // すべての date
      var date_list = this.sheet.getRange(2, 1, last_row - 1, 1).getValues();
      for (var i = 0; i < date_list.length; i++) {
        result_list.push(this.findById(i + 2));
      }
      return result_list;
    };

    /**
    * 履歴を永続化する
    */
    AttendanceHistoryRepository.prototype.store = function(history) {
      // 勤怠ステータス名
      var status_name = history.getStatus() ? history.getStatus().getName() : null;
      if (history.getId() === null) {
        // insert
        this.sheet.appendRow([history.getDate(), status_name, history.getStartTime(), history.getEndTime(), history.getRestTime(), history.isStartNotified(), history.isLeavingWorkNotified(), history.isFinishNotified()]);
        var attendance_record = new JobcanAttendanceReader.AttendanceRecord(
          history.getDate(),
          null, 
          history.getStartTime(),
          history.getEndTime(),
          history.getRestTime(),
          null
        );
        return new AttendanceHistory(this.sheet.getLastRow(), attendance_record, history.isStartNotified(), history.isLeavingWorkNotified(), history.isFinishNotified());
      }
      // update
      var range = this._getRecordRange(history.getId());
      range.setValues([[history.getDate(), status_name, history.getStartTime(), history.getEndTime(), history.getRestTime(), history.isStartNotified(), history.isLeavingWorkNotified(), history.isFinishNotified()]]);
      return history;
    };
    
    /**
    * レコードをモデルに変換する
    */
    AttendanceHistoryRepository.prototype._toModel = function(id, record) {
      var attendance_record = new JobcanAttendanceReader.AttendanceRecord(
        new Date(record[0]),
        record[1] ? JobcanAttendanceReader.AttendanceStatusType.valueOf(record[1]) : null, 
        record[2] ? new Date(record[2]) : null,
        record[3] ? new Date(record[3]) : null,
        record[4] ? record[4] : null,
        null
      );
      return new AttendanceHistory(
        id,
        attendance_record,
        record[5],
        record[6],
        record[7]
      );
    };
    
    AttendanceHistoryRepository.prototype._getRecordRange = function(row) {
      // 指定の行の1行、A列からの7列を取得
      return this.sheet.getRange(row, 1, 1, 8);
    };

    AttendanceHistoryRepository.toString = function() {
      return 'AttendanceHistoryRepository';
    };
    
    return AttendanceHistoryRepository;
  })();
  
  global.AttendanceHistoryRepository = AttendanceHistoryRepository;
  
})(this);
