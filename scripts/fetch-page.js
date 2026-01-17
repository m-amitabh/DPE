(async () => {
  try {
    const res = await fetch('http://localhost:5173/');
    const txt = await res.text();
    // print only surrounding area where our markdown will be rendered
    console.log(txt.slice(0, 2000));
  } catch (e) {
    console.error('fetch error', e);
    process.exit(1);
  }
})();
