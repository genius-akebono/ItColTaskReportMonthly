/**
 * 月次レポート機能のJavaScript
 */

let currentGroupBy = 'project';

/**
 * レポートデータを読み込む
 */
function loadReport() {
    const year = document.getElementById('year').value;
    const month = document.getElementById('month').value;

    // 期間表示を更新
    document.getElementById('report-period').textContent = `${year}年${month}月`;

    // APIからデータを取得
    fetch(`/api/report/monthly?year=${year}&month=${month}&group_by=${currentGroupBy}`)
        .then(response => response.json())
        .then(data => {
            updateReport(data);
        })
        .catch(error => {
            console.error('Error loading report:', error);
            alert('レポートの読み込み中にエラーが発生しました');
        });
}

/**
 * レポート表示を更新
 */
function updateReport(data) {
    // サマリー情報を更新
    document.getElementById('total-days').textContent = data.total_days;
    document.getElementById('total-hours').textContent = data.total_hours;

    // テーブルのヘッダーを更新
    const thead = document.querySelector('.report-table thead');
    const nameLabel = currentGroupBy === 'project' ? 'プロジェクト名' : 'カテゴリ';
    thead.innerHTML = `
        <tr>
            <th class="col-name">${nameLabel}</th>
            <th class="col-hours">作業時間</th>
            <th class="col-percentage">割合</th>
            <th class="col-bar">グラフ</th>
        </tr>
    `;

    // テーブルボディを更新
    const tbody = document.getElementById('report-tbody');

    if (data.items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: #999;">
                    この期間のデータはありません
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    data.items.forEach(item => {
        html += `
            <tr>
                <td class="col-name">${escapeHtml(item.name)}</td>
                <td class="col-hours">${item.hours} 時間</td>
                <td class="col-percentage">${item.percentage}%</td>
                <td class="col-bar">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.percentage}%">
                            ${item.percentage >= 10 ? item.percentage + '%' : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/**
 * 集計軸を切り替え
 */
function changeGroupBy(groupBy) {
    currentGroupBy = groupBy;

    // ボタンのアクティブ状態を更新
    document.getElementById('btn-project').classList.remove('active');
    document.getElementById('btn-category').classList.remove('active');

    if (groupBy === 'project') {
        document.getElementById('btn-project').classList.add('active');
    } else {
        document.getElementById('btn-category').classList.add('active');
    }

    // レポートを再読み込み
    loadReport();
}

/**
 * HTMLエスケープ処理
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * ページロード時に実行
 */
document.addEventListener('DOMContentLoaded', () => {
    // 初期データ読み込み
    loadReport();
});
