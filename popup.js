var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

var rect_x = 60
var rect_y = 100
var text_x = 90
var text_y = 90

ctx.font = 'bold 24px comicsans'
ctx.fillText('Tab Manager',30, 50);

ctx.font = 'bold 16px comicsans'
ctx.textAlign = 'center'
ctx.fillText('6 hours', text_x, text_y);
ctx.fillText('4 hours', text_x + 260, text_y);
ctx.fillText('2 hours', text_x, text_y + 200);
ctx.fillText('Excepted', text_x + 260, text_y + 200);

for (let i = 0; i < 2; i++){
    for (let j = 0; j < 2; j++){
        shadowRect(rect_x + 260 * j + 2, rect_y + 200 * i + 2, 220, 160, 10, '#DDDDDD')

        ctx.fillStyle = '#EEEEEE';
        ctx.strokeStyle = "#CCCCCC"

        ctx.fillRect(rect_x + 260 * j, rect_y + 200 * i, 220, 160);
        ctx.strokeRect(rect_x + 260 * j, rect_y + 200 * i, 220, 160);
    }
}

//shadowRect(60,100,220,160,5,'#777777');

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