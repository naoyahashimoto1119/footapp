// frontend/script.js

// --- 設定 ---
// FastAPI バックエンドのURL（ポートは uvicorn のポートに合わせる）
const API_BASE_URL = "http://127.0.0.1:8000";

const fileInput = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const previewImage = document.getElementById("previewImage");
const resultText = document.getElementById("resultText");
const probTable = document.getElementById("probTable");

let selectedFile = null;

// 画像を選んだときの処理
fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    selectedFile = null;
    analyzeBtn.disabled = true;
    previewImage.src = "";
    resultText.textContent = "ファイルが選択されていません。";
    probTable.innerHTML = "";
    return;
  }
  selectedFile = file;
  analyzeBtn.disabled = false;

  // プレビュー表示
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
  };
  reader.readAsDataURL(file);

  resultText.textContent = "画像が選択されました。「AIで分析する」を押してください。";
  probTable.innerHTML = "";
});

// ボタンを押したときの処理
analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  resultText.textContent = "分析中です...";
  probTable.innerHTML = "";

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    // 結果表示
    resultText.innerHTML = `
      <p><strong>推定された足タイプ：</strong>${data.label}</p>
      <p>${data.description}</p>
    `;

    // 確率の表を作成
    if (data.probabilities) {
      const entries = Object.entries(data.probabilities);
      let html = "<table><thead><tr><th>クラス</th><th>確率</th></tr></thead><tbody>";
      entries.forEach(([label, prob]) => {
        const percent = (prob * 100).toFixed(1);
        html += `<tr><td>${label}</td><td>${percent}%</td></tr>`;
      });
      html += "</tbody></table>";
      probTable.innerHTML = html;
    }
  } catch (err) {
    console.error(err);
    resultText.textContent = "分析中にエラーが発生しました。コンソールを確認してください。";
  }
});
