from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
from sqlalchemy import func, extract
import os

app = Flask(__name__)

# 環境変数でデータベースを切り替え可能
# デフォルトはSQLite、USE_POSTGRESQL=1でPostgreSQLを使用
USE_POSTGRESQL = os.environ.get('USE_POSTGRESQL') == '1'

if USE_POSTGRESQL:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://todo_user:todo_password@localhost/todo_db'
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    task_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    memo = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=False, default=0)
    created_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)


@app.route("/")
def home():
    """タスク登録画面表示（当日のタスク一覧含む）"""
    today = date.today()
    task_list = Task.query.filter_by(created_date=today).order_by(Task.created_at.desc()).all()

    # 当日の総作業時間を計算
    total_seconds = db.session.query(func.sum(Task.duration_seconds)).filter_by(created_date=today).scalar() or 0
    total_hours = total_seconds / 3600.0

    # データベース情報を取得
    db_info = None
    if USE_POSTGRESQL:
        db_info = {
            'type': 'PostgreSQL',
            'database': 'todo_db',
            'user': 'todo_user',
            'host': 'localhost'
        }

    return render_template("index.html",
                         task_list=task_list,
                         db_info=db_info,
                         total_hours=total_hours,
                         today=today)


@app.route("/task/add", methods=["POST"])
def add_task():
    """新規タスク登録"""
    task_name = request.form.get("task_name")
    category = request.form.get("category")
    memo = request.form.get("memo", "")
    created_date = request.form.get("created_date")

    if not created_date:
        created_date = date.today()
    else:
        created_date = datetime.strptime(created_date, "%Y-%m-%d").date()

    new_task = Task(
        task_name=task_name,
        category=category,
        memo=memo,
        created_date=created_date
    )
    db.session.add(new_task)
    db.session.commit()
    return redirect(url_for("home"))


@app.route("/task/start", methods=["POST"])
def start_task():
    """タイマー開始（start_time記録）"""
    task_id = request.form.get("task_id")
    task = Task.query.get(task_id)

    if task:
        task.start_time = datetime.now()
        db.session.commit()
        return jsonify({
            "success": True,
            "start_time": task.start_time.isoformat(),
            "task_id": task.id
        })

    return jsonify({"success": False, "error": "Task not found"}), 404


@app.route("/task/stop", methods=["POST"])
def stop_task():
    """タイマー停止（end_time, duration_seconds記録）"""
    task_id = request.form.get("task_id")
    task = Task.query.get(task_id)

    if task and task.start_time:
        task.end_time = datetime.now()
        duration = (task.end_time - task.start_time).total_seconds()
        task.duration_seconds = int(duration)
        db.session.commit()
        return jsonify({
            "success": True,
            "end_time": task.end_time.isoformat(),
            "duration_seconds": task.duration_seconds,
            "duration_hours": round(task.duration_seconds / 3600.0, 2)
        })

    return jsonify({"success": False, "error": "Task not found or not started"}), 400


@app.route("/task/delete/<int:task_id>", methods=["POST"])
def delete_task(task_id):
    """タスク削除"""
    task = Task.query.get(task_id)
    if task:
        db.session.delete(task)
        db.session.commit()
    return redirect(url_for("home"))


@app.route("/report")
def report():
    """月次レポート画面表示"""
    # デフォルトは当月
    year = request.args.get("year", datetime.now().year, type=int)
    month = request.args.get("month", datetime.now().month, type=int)

    # 年月のリストを生成（過去12ヶ月分）
    years = list(range(datetime.now().year - 1, datetime.now().year + 1))
    months = list(range(1, 13))

    return render_template("report.html",
                         current_year=year,
                         current_month=month,
                         years=years,
                         months=months)


@app.route("/api/report/monthly")
def monthly_report():
    """月次集計データ取得（JSON）"""
    year = request.args.get("year", datetime.now().year, type=int)
    month = request.args.get("month", datetime.now().month, type=int)
    group_by = request.args.get("group_by", "project")  # project or category

    # 該当月のタスクをフィルタ
    tasks = Task.query.filter(
        extract('year', Task.created_date) == year,
        extract('month', Task.created_date) == month
    ).all()

    # 総作業時間と総作業日数を計算
    total_seconds = sum(task.duration_seconds for task in tasks)
    total_hours = total_seconds / 3600.0
    unique_dates = len(set(task.created_date for task in tasks))

    # グループ別集計
    if group_by == "category":
        group_field = Task.category
        label = "category"
    else:
        group_field = Task.task_name
        label = "project"

    # SQLAlchemyで集計
    results = db.session.query(
        group_field,
        func.sum(Task.duration_seconds).label('total_seconds'),
        func.count(func.distinct(Task.created_date)).label('work_days')
    ).filter(
        extract('year', Task.created_date) == year,
        extract('month', Task.created_date) == month
    ).group_by(group_field).all()

    # 結果を整形
    items = []
    for result in results:
        name = result[0]
        seconds = result[1]
        hours = seconds / 3600.0
        percentage = (seconds / total_seconds * 100) if total_seconds > 0 else 0

        items.append({
            "name": name,
            "hours": round(hours, 1),
            "percentage": round(percentage, 1),
            "work_days": result[2]
        })

    # 作業時間の降順でソート
    items.sort(key=lambda x: x['hours'], reverse=True)

    return jsonify({
        "year": year,
        "month": month,
        "total_hours": round(total_hours, 1),
        "total_days": unique_dates,
        "group_by": group_by,
        "items": items
    })


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
