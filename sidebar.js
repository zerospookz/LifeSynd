
fetch("sidebar.html").then(r=>r.text()).then(h=>document.body.insertAdjacentHTML("afterbegin",h));
