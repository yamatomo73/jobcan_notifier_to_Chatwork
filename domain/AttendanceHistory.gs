(function(global){
  var AttendanceHistory = (function() {
    
    /**
     * 勤怠履歴エンティティ
     *
     * @param {id|null} id
     * @param {AttendanceRecord} attendance_record
     * @param {bool} start_notified
     * @param {bool} leaving_work_notified
     * @param {bool} finish_notified
     */
    function AttendanceHistory(id, attendance_record, start_notified, leaving_work_notified, finish_notified)
    {
      this.id = id;
      this.attendance_record = attendance_record;
      // this.date = new Date();
      this.start_notified = Boolean(start_notified);
      this.leaving_work_notified = Boolean(leaving_work_notified);
      this.finish_notified = Boolean(finish_notified);
    };
    
    /*
     * 開始通知すべきかどうか
     * @return {boolean} 開始通知すべきであればtrue
     */
    AttendanceHistory.prototype.shouldStartNotify = function() {
      return false === this.start_notified && false === this.finish_notified && this.attendance_record.getEndTime() === null && this.attendance_record.getStartTime() !== null;
    }

    /*
    * 開始通知
    */
    AttendanceHistory.prototype.startNotify = function() {
      return new AttendanceHistory(this.id, this.attendance_record, true, this.leaving_work_notified, this.finish_notified);
    };
    
    /*
    * 退勤予告通知すべきかどうか
    * @return {boolean} 開始通知すべきであればtrue
    */
    AttendanceHistory.prototype.shouldLeavingWorkNotify = function(work_regulation) {
      if (true === this.leaving_work_notified || false === this.start_notified || true === this.finish_notified) {
        return false;
      }
      var remain_min = work_regulation.remainingWorkTime(this.attendance_record);
      // TODO 定時20分以内になったら通知
      return remain_min <= 20;
    }

    /*
    * 退勤予告通知
    */
    AttendanceHistory.prototype.leavingWorkNotify = function() {
      return new AttendanceHistory(this.id, this.attendance_record, this.start_notified, true, this.finish_notified);
    };
    
    /*
    * 終了通知すべきかどうか
    * @return {boolean} 開始通知すべきであればtrue
    */
    AttendanceHistory.prototype.shouldFinishNotify = function() {
      return false === this.finish_notified && this.attendance_record.getEndTime() !== null;
    }

    /*
    * 終了通知
    */
    AttendanceHistory.prototype.finishNotify = function() {
      return new AttendanceHistory(this.id, this.attendance_record, this.start_notified, this.leaving_work_notified, true);
    };

    AttendanceHistory.prototype.getId = function() {
      return this.id;
    };
    
    AttendanceHistory.prototype.getAttendanceRecord = function() {
      return this.attendance_record;
    };

    AttendanceHistory.prototype.getDate = function() {
      return this.attendance_record.getDate();
    };
    
    AttendanceHistory.prototype.getStatus = function() {
      return this.attendance_record.getStatus();
    };
    
    AttendanceHistory.prototype.getStartTime = function() {
      return this.attendance_record.getStartTime();
    };
    
    AttendanceHistory.prototype.getEndTime = function() {
      return this.attendance_record.getEndTime();
    };
    
    AttendanceHistory.prototype.getRestTime = function() {
      return this.attendance_record.getRestMinutes();
    };
    
    AttendanceHistory.prototype.isStartNotified = function() {
      return this.start_notified;
    };
    
    AttendanceHistory.prototype.isLeavingWorkNotified = function() {
      return this.leaving_work_notified;
    };
    
    AttendanceHistory.prototype.isFinishNotified = function() {
      return this.finish_notified;
    };
    
    AttendanceHistory.prototype.toRecord = function() {
      return [this.id, 
              this.getDate(), this.getStartTime(), this.getEndTime(), this.getRestTime(), 
              this.start_notified, this.leaving_work_notified, this.finish_notified
             ];
    };
    
    AttendanceHistory.toString = function() {
      return 'AttendanceHistory';
    };
    
    return AttendanceHistory;
  })();
  
  global.AttendanceHistory = AttendanceHistory;
  
})(this);


(function(global){
  var AttendanceHistories = (function() {
    
    /**
     * 勤怠履歴コレクション
     */
    function AttendanceHistories(history_list)
    {
      this.history_list = history_list;
      var records = [];
      for (var i = 0; i < this.history_list.length; i++) {
        records.push(this.history_list[i].getAttendanceRecord());
      }
      this.attendance_records = new JobcanAttendanceReader.AttendanceRecords(records);
    };
    
    /*
     * 勤務日数
     * @return {int} 
     */
    AttendanceHistories.prototype.workingDayCount = function() {
      return this.attendance_records.workingDayCount();
    }

    /*
     * 総残業時間（分）
     * @return {int} 
     */
    AttendanceHistories.prototype.overTime = function() {
      return this.attendance_records.overTime();
    }
    
    return AttendanceHistories;
  })();
  
  global.AttendanceHistories = AttendanceHistories;
  
})(this);

