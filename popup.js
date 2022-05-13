var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var rect_x = 20
var rect_y = 100
var text_x = 50
var text_y = 90

ctx.font = 'bold 24px serif'
//ctx.textAlign = 'center'
ctx.fillText('Tab Manager',30, 50);

ctx.font = 'bold 14px serif'
ctx.textAlign = 'center'
ctx.fillText('6 hours', text_x, text_y);
ctx.fillText('4 hours', text_x + 200, text_y);
ctx.fillText('2 hours', text_x, text_y + 200);
ctx.fillText('Excepted', text_x + 200, text_y + 200);

ctx.fillStyle = '#EEEEEE';
ctx.strokeStyle = "#777777"

for (let i = 0; i < 2; i++){
    for (let j = 0; j < 2; j++){
        ctx.fillRect(rect_x + 200 * j, rect_y + 200 * i, 160, 160);
        ctx.strokeRect(rect_x + 200 * j, rect_y + 200 * i, 160, 160);
    }
}