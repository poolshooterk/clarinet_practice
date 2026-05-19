const DEEP_LINK = 'clarinets:///reset-password';

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>パスワードリセット</title>
  <style>
    body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
         justify-content:center;min-height:100vh;margin:0;background:#f0f4f8}
    .card{background:#fff;padding:2rem;border-radius:12px;
          box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;max-width:360px;width:90%}
    h1{font-size:1.25rem;margin:0 0 .5rem}
    p{color:#666;margin:0 0 1.5rem}
    a{display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;
      padding:.75rem 2rem;border-radius:8px;font-size:1rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>パスワードリセット</h1>
    <p>下のボタンをタップして<br>アプリでパスワードを再設定してください</p>
    <a id="btn" href="${DEEP_LINK}">アプリを開く</a>
  </div>
  <script>
    var h = location.hash;
    if (h) document.getElementById('btn').href = '${DEEP_LINK}' + h;
  </script>
</body>
</html>`;

Deno.serve(
  () =>
    new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
);
