var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

var rect_x = 60
var rect_y = 103
var text_x = 68
var text_y = 93

ctx.font = 'bold 24px comicsans'
ctx.fillText('Tab Manager', 30, 50);

ctx.font = 'bold 18px comicsans'
ctx.textAlign = 'left'
ctx.fillText('Threshold 2', text_x, text_y);
ctx.fillText('Threshold 1', text_x + 260, text_y);
// ctx.fillText('2 hours', text_x, text_y + 200);
// ctx.fillText('Excepted', text_x + 260, text_y + 200);

for (let i = 0; i < 2; i++) {
    shadowRect(rect_x + 260 * i + 5, rect_y + 5, 215, 155, 10, '#DDDDDD');

    ctx.fillStyle = '#EEEEEE';
    ctx.strokeStyle = "#CCCCCC"
    roundRect(ctx, rect_x + 260 * i, rect_y, 220, 160, 10, true, true);
}

var thresholdBar1 = document.getElementById("thresholdRange1");
var thresholdValue1 = document.getElementById("thresholdValue1");
var thresholdBar2 = document.getElementById("thresholdRange2");
var thresholdValue2 = document.getElementById("thresholdValue2");

var closeButton2 = document.getElementById("closeT2");
var closeButton1 = document.getElementById("closeT1");
let tabs_info = [[],[]];

window.onload = function () {
    chrome.runtime.sendMessage({ type: "2" }, function (response) {
        console.log(response);
        console.log(response["tab_info"]["first"]);
        console.log(response["tab_info"]["second"]);
        tabs_info[0] = response["tab_info"]["first"];
        tabs_info[1] = response["tab_info"]["second"];
    });
}

chrome.storage.sync.get(["threshold1", "threshold2"], function (items) {
    thresholdBar1.value = items["threshold1"];
    thresholdBar2.value = items["threshold2"];
    thresholdValue1.innerHTML = thresholdBar1.value;
    thresholdValue2.innerHTML = thresholdBar2.value;
});

closeButton2.onclick = function () {
    chrome.runtime.sendMessage({ type: 0, level: 1 }, function (response) {
        console.log(response.resp);
    });
    console.log("Close T2 Clicked");
}
closeButton1.onclick = function () {
    chrome.runtime.sendMessage({ type: 0, level: 0 }, function (response) {
        console.log(response.resp);
    });
    console.log("Close T1 Clicked");
}

thresholdBar1.oninput = function () {
    thresholdValue1.innerHTML = thresholdBar1.value;
    chrome.storage.sync.set({ "threshold1": thresholdBar1.value });
    chrome.runtime.sendMessage({ type: 1, thresholds: [thresholdBar1.value, thresholdBar2.value] }, function (response) {
        console.log(response.resp);
    });
    console.log(this.value);
}
thresholdBar2.oninput = function () {
    thresholdValue2.innerHTML = thresholdBar2.value;
    chrome.storage.sync.set({ "threshold2": thresholdBar2.value });
    chrome.runtime.sendMessage({ type: 1, thresholds: [thresholdBar1.value, thresholdBar2.value] }, function (response) {
        console.log(response.resp);
    });
    console.log(this.value);
}

var fav = new Image();
fav.src = "https://stackoverflow.com/favicon.ico";
fav.onload = function () {
    ctx.drawImage(fav, 100, 100, 100, 100);
}

function shadowRect(x, y, w, h, repeats, color) {
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    for (var i = 0; i < repeats; i++) {
        ctx.shadowBlur += 0.25;
        ctx.strokeRect(x, y, w, h);
    }
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') {
        stroke = true;
    }
    if (typeof radius === 'undefined') {
        radius = 5;
    }
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
        var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    if (stroke) {
        ctx.stroke();
    }
}

function max(a, b) {
    if (a > b) return a;
    else return b;
}

function min(a, b) {
    if (a > b) return b;
    else return a;
}