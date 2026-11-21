/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจากองค์ประกอบในหน้า แล้วทำงานเฉพาะส่วนที่เกี่ยวข้อง
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================================== */

(function () {
  "use strict";

  var PRODUCTS_URL = "products.json";
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwnlJtx7-QgyZnJWThJWRoGUAdDeJn1O6RP2_oZ5Zcnp1Dcqj7yP8ipMvCDoMfdQ5hpCw/exec";
  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRszRdi5YhhMPlsZg9pMaoV-aEnZjJYsun3C-TlnXYTJ4-5HNQfHz00EjkyC3acbDdbfy1eStDIl36m/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("product-list")) initProductPage();
    if (document.getElementById("orderForm")) initOrderPage();
    if (document.querySelector("#ordersTable tbody")) initAdminPage();
  });

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(price) {
    return Number(price).toLocaleString("th-TH") + " บาท";
  }

  // ชื่อที่ใช้ส่งไปหน้าสั่งซื้อ เช่น "น้ำหอมฉีดตัว Fresh เล็ก 30ml"
  function itemLabel(product) {
    return product.size ? product.name + " " + product.size : product.name;
  }

  /* ------------------------------------------------------------------
     1) product.html — การ์ดสินค้า + ปุ่มกรอง mood
     ------------------------------------------------------------------ */

  function initProductPage() {
    var list = document.getElementById("product-list");
    var bar = document.getElementById("filter-bar");
    var products = [];

    var params = new URLSearchParams(window.location.search);
    var requested = (params.get("mood") || "all").toLowerCase();
    var current = MOODS.some(function (m) { return m.key === requested; })
      ? requested
      : "all";

    buildFilterBar();

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (error) {
        console.error(error);
        list.replaceChildren(
          el("p", "text-center", "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง")
        );
      });

    function buildFilterBar() {
      if (!bar) return;
      bar.replaceChildren();
      MOODS.forEach(function (m) {
        var btn = el("button", "filter", m.label);
        btn.type = "button";
        btn.dataset.filter = m.key;
        if (m.key !== "all") btn.dataset.mood = m.key; // ให้ CSS แต้มจุดสี mood
        btn.addEventListener("click", function () {
          current = m.key;
          updateUrl();
          render();
        });
        bar.appendChild(btn);
      });
    }

    function updateUrl() {
      var url = new URL(window.location.href);
      if (current === "all") url.searchParams.delete("mood");
      else url.searchParams.set("mood", current);
      history.replaceState(null, "", url);
    }

    function render() {
      if (bar) {
        Array.prototype.forEach.call(bar.querySelectorAll(".filter"), function (btn) {
          var active = btn.dataset.filter === current;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }

      var shown = products.filter(function (p) {
        return current === "all" || p.mood === current;
      });

      list.replaceChildren();
      if (!shown.length) {
        list.appendChild(el("p", "text-center", "ยังไม่มีสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function buildCard(p) {
      var card = el("article", "card");
      card.dataset.mood = p.mood;

      var media = el("div", "card-media");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "card-body");
      body.appendChild(el("span", "mood-tag", p.mood.charAt(0).toUpperCase() + p.mood.slice(1)));
      body.appendChild(el("h3", "card-title", p.name));
      if (p.size) body.appendChild(el("p", "card-meta", p.size));

      var foot = el("div", "card-foot");
      foot.appendChild(el("span", "price", formatPrice(p.price)));

      var orderParams = new URLSearchParams();
      orderParams.set("item", itemLabel(p));
      orderParams.set("price", p.price);
      var buy = el("a", "btn btn--small", "สั่งซื้อ");
      buy.href = "order.html?" + orderParams.toString();
      foot.appendChild(buy);

      body.appendChild(foot);
      card.appendChild(media);
      card.appendChild(body);
      return card;
    }
  }

  /* ------------------------------------------------------------------
     2) order.html — เติมฟอร์มจาก URL + ส่งออเดอร์
     ------------------------------------------------------------------ */

  function initOrderPage() {
    var form = document.getElementById("orderForm");
    var params = new URLSearchParams(window.location.search);

    var itemsField = document.getElementById("items");
    var totalField = document.getElementById("total");

    // เติมทั้งสองช่องทันทีที่โหลดหน้า
    if (itemsField) itemsField.value = params.get("item") || "";
    if (totalField) totalField.value = params.get("price") || "";

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ------------------------------------------------------------------
     3) admin.html — ตารางออเดอร์จาก Google Sheet (CSV)
     ------------------------------------------------------------------ */

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    var COLUMNS = 6;

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (row) {
          return row.some(function (cell) { return cell.trim() !== ""; });
        });

        rows.shift(); // แถวแรกเป็นหัวคอลัมน์

        if (!rows.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // Sheet ต่อแถวใหม่ไว้ท้ายสุดเสมอ จึงกลับลำดับให้รายการล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.replaceChildren();
        rows.forEach(function (row) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLUMNS; i++) {
            tr.appendChild(el("td", "", row[i] !== undefined ? row[i] : ""));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      });

    function showMessage(message) {
      var tr = document.createElement("tr");
      var td = el("td", "text-center", message);
      td.colSpan = COLUMNS;
      tr.appendChild(td);
      tbody.replaceChildren(tr);
    }
  }

  // parse CSV เอง: รองรับ "เครื่องหมายคำพูด", "" (escape), คอมมาและขึ้นบรรทัดใหม่ในเซลล์, CRLF
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }
})();
