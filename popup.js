var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

var rect_x = 60
var rect_y = 103
var text_x = 68
var text_y = 93

ctx.font = 'bold 24px comicsans'
ctx.fillText('Tab Manager',30, 50);

ctx.font = 'bold 18px comicsans'
ctx.textAlign = 'left'
ctx.fillText('6 hours', text_x, text_y);
ctx.fillText('4 hours', text_x + 260, text_y);
ctx.fillText('2 hours', text_x, text_y + 200);
ctx.fillText('Excepted', text_x + 260, text_y + 200);

for (let i = 0; i < 2; i++){
    for (let j = 0; j < 2; j++){
        shadowRect(rect_x + 260 * j + 5, rect_y + 200 * i + 5, 215, 155, 10, '#DDDDDD');
        
        ctx.fillStyle = '#EEEEEE';
        ctx.strokeStyle = "#CCCCCC"
        roundRect(ctx, rect_x + 260 * j, rect_y + 200 * i, 220, 160, 10, true, true);
    }
}

var thresholdBar = document.getElementById("thresholdRange");
var y = document.getElementById("thresholdValue");
thresholdBar.oninput = function(){
    console.log(this.value);
    y.innerHTML = thresholdBar.value;
}
function shadowRect(x,y,w,h,repeats,color){
    ctx.strokeStyle=color;
    ctx.shadowColor=color;
    ctx.shadowBlur=5;
    for(var i=0;i<repeats;i++){
        ctx.shadowBlur+=0.25;
        ctx.strokeRect(x,y,w,h);
    }
    ctx.shadowColor='rgba(0,0,0,0)';
    ctx.lineWidth=1;
    ctx.strokeRect(x+2,y+2,w-4,h-4);

}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') {
        stroke = true;
    }
    if (typeof radius === 'undefined') {
        radius = 5;
    }
    if (typeof radius === 'number') {
        radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
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