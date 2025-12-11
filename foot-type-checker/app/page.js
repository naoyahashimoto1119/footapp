'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setImageData(event.target.result.split(',')[1]);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFootType = async () => {
    if (!imageData) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      });

      const data = await response.json();
      
      if (data.error) {
        setResult({ error: data.error });
      } else {
        setResult(data);
      }
    } catch (error) {
      console.error('分析エラー:', error);
      setResult({ error: '分析中にエラーが発生しました。もう一度お試しください。' });
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setImage(null);
    setImageData(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getTypeClass = (type) => {
    if (type?.includes('エジプト')) return 'egypt';
    if (type?.includes('ギリシャ')) return 'greek';
    if (type?.includes('スクエア')) return 'square';
    return '';
  };

  const getTypeEmoji = (type) => {
    if (type?.includes('エジプト')) return '🏛️';
    if (type?.includes('ギリシャ')) return '🏺';
    if (type?.includes('スクエア')) return '⬜';
    return '👣';
  };

  return (
    <div className="container">
      <div className="header">
        <h1>👣 足型診断</h1>
        <p>足を上から撮影して、あなたの足型をチェック！</p>
      </div>

      {!result && (
        <div className="card">
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
            3つの足型タイプ
          </h2>
          <div className="type-list">
            <div className="type-item egypt">
              <span className="emoji">🏛️</span>
              <div>
                <span className="label">エジプト型</span>
                <p className="desc">親指が一番長い</p>
              </div>
            </div>
            <div className="type-item greek">
              <span className="emoji">🏺</span>
              <div>
                <span className="label">ギリシャ型</span>
                <p className="desc">人差し指が一番長い</p>
              </div>
            </div>
            <div className="type-item square">
              <span className="emoji">⬜</span>
              <div>
                <span className="label">スクエア型</span>
                <p className="desc">指の長さが揃っている</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!image ? (
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <div className="icon">📸</div>
          <p className="text">タップして足の写真を選択</p>
          <p className="hint">真上から両足を撮影してください</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>
      ) : (
        <div className="card">
          <img src={image} alt="アップロードした足の写真" className="preview-image" />
          
          {!result && !loading && (
            <>
              <button className="button button-primary" onClick={analyzeFootType}>
                🔍 足型を診断する
              </button>
              <button className="button button-secondary" onClick={resetApp}>
                写真を撮り直す
              </button>
            </>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner">👣</div>
              <p style={{ color: '#64748b', marginTop: '8px' }}>分析中...</p>
            </div>
          )}
        </div>
      )}

      {result && !result.error && (
        <>
          <div className={`result-main ${getTypeClass(result.footType)}`}>
            <div className="emoji">{getTypeEmoji(result.footType)}</div>
            <h2>{result.footType}</h2>
            <p className="confidence">信頼度: {result.confidence}</p>
          </div>

          <div className="card result-section">
            <h3>📝 判定理由</h3>
            <p>{result.description}</p>
          </div>

          <div className="card result-section">
            <h3>✨ あなたの足の特徴</h3>
            <ul>
              {result.characteristics?.map((char, i) => (
                <li key={i}>{char}</li>
              ))}
            </ul>
          </div>

          <div className="card result-section">
            <h3>👟 靴選びのヒント</h3>
            <p>{result.shoeTips}</p>
          </div>

          <button className="button button-secondary" onClick={resetApp}>
            もう一度診断する
          </button>
        </>
      )}

      {result?.error && (
        <div className="error">
          <p>{result.error}</p>
          <button 
            className="button button-secondary" 
            onClick={resetApp}
            style={{ marginTop: '12px' }}
          >
            やり直す
          </button>
        </div>
      )}

      <p className="footer">※この診断は参考情報です</p>
    </div>
  );
}
