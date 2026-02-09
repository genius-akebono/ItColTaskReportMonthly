// タイマー管理用のオブジェクト
const timers = {};

/**
 * タイマー開始処理
 */
function startTimer(taskId) {
    // フォームデータを作成
    const formData = new FormData();
    formData.append('task_id', taskId);

    // サーバーにタイマー開始をリクエスト
    fetch('/task/start', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // タイマー表示を開始
            const startTime = new Date(data.start_time);
            const timerDisplay = document.getElementById(`timer-${taskId}`);

            // タイマー更新処理
            timers[taskId] = setInterval(() => {
                const now = new Date();
                const elapsed = Math.floor((now - startTime) / 1000); // 経過秒数
                const hours = Math.floor(elapsed / 3600);
                const minutes = Math.floor((elapsed % 3600) / 60);
                const seconds = elapsed % 60;

                // hh:mm:ss 形式で表示
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                timerDisplay.innerHTML = `<span class="status-running">${timeString}</span>`;
            }, 1000);

            // ボタンを切り替え
            const taskItem = document.querySelector(`[data-task-id="${taskId}"]`);
            const startBtn = taskItem.querySelector('.btn-start');
            if (startBtn) {
                startBtn.outerHTML = `<button class="btn-stop" onclick="stopTimer(${taskId})">STOP</button>`;
            }

            console.log(`Timer started for task ${taskId}`);
        } else {
            alert('タイマーの開始に失敗しました: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('タイマーの開始中にエラーが発生しました');
    });
}

/**
 * タイマー停止処理
 */
function stopTimer(taskId) {
    // タイマー更新処理を停止
    if (timers[taskId]) {
        clearInterval(timers[taskId]);
        delete timers[taskId];
    }

    // フォームデータを作成
    const formData = new FormData();
    formData.append('task_id', taskId);

    // サーバーにタイマー停止をリクエスト
    fetch('/task/stop', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // タイマー表示を更新 (hh:mm:ss形式)
            const timerDisplay = document.getElementById(`timer-${taskId}`);

            // `data.duration_hours` は小数の時間（例: 1.5 -> 1時間30分）なので秒に変換
            const totalSeconds = Math.round(data.duration_hours * 3600);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            timerDisplay.innerHTML = `<span class="status-stopped">${timeString}</span>`;

            // ボタンを削除
            const taskItem = document.querySelector(`[data-task-id="${taskId}"]`);
            const stopBtn = taskItem.querySelector('.btn-stop');
            if (stopBtn) {
                stopBtn.remove();
            }

            // ページをリロードして最新の状態を反映
            setTimeout(() => {
                window.location.reload();
            }, 1000);

            console.log(`Timer stopped for task ${taskId}. Duration: ${timeString} (${data.duration_hours} hours)`);
        } else {
            alert('タイマーの停止に失敗しました: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('タイマーの停止中にエラーが発生しました');
    });
}

/**
 * ページロード時に実行中のタイマーを再開
 */
document.addEventListener('DOMContentLoaded', () => {
    // 実行中のタスクを探す
    const runningTasks = document.querySelectorAll('.status-running');

    runningTasks.forEach(statusElement => {
        const taskItem = statusElement.closest('.task-item');
        if (taskItem) {
            const taskId = taskItem.getAttribute('data-task-id');
            const stopBtn = taskItem.querySelector('.btn-stop');

            if (stopBtn) {
                // start_timeを取得する必要があるが、HTMLに含まれていないため
                // とりあえず現在時刻から開始したものとして表示
                // 正確な時間を表示するには、バックエンドからstart_timeを渡す必要がある
                console.log(`Found running task: ${taskId}`);
            }
        }
    });
});
