import { SingleTouchListener, isTouchSupported, KeyboardHandler } from './io.js';
import { getHeight, getWidth, RGB, Sprite, blendAlphaCopy } from './gui.js';
import { FixedSizeQueue, Queue } from './utils.js';
import { menu_font_size, SquareAABBCollidable } from './game_utils.js';
class Snake {
    constructor(game, initial_len, head_pos) {
        this.game = game;
        this.init(initial_len, head_pos);
    }
    init(initial_len, head_pos) {
        this.direction = [1, 0];
        this.color = new RGB(255, 255, 255, 255);
        this.initial_len = initial_len;
        this.head_pos = head_pos;
    }
    init_snake() {
        this.indexes = new Queue();
        for (let i = 0; i < this.initial_len; i++) {
            const index = this.head_pos + i;
            this.indexes.push(index);
            this.game.add_snake_piece(index);
        }
    }
    self_collision() {
        const visited = new Set();
        for (let i = 0; i < this.indexes.length; i++) {
            const current_cell = this.indexes.get(i);
            if (!visited.has(current_cell))
                visited.add(current_cell);
            else
                return true;
        }
        return false;
    }
    move(game) {
        const removed = this.indexes.pop();
        game.remove_snake_piece(removed);
        if (this.direction[0] > 0) {
            const new_piece_index = this.head_pos + 1;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[0] < 0) {
            const new_piece_index = this.head_pos - 1;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[1] > 0) {
            const new_piece_index = this.head_pos + game.screen_buf.width;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[1] < 0) {
            const new_piece_index = this.head_pos - game.screen_buf.width;
            this.indexes.push(new_piece_index);
        }
        this.head_pos = this.indexes.get(this.indexes.length - 1);
        game.add_snake_piece(this.head_pos);
    }
}
;
class Food {
}
;
class Game extends SquareAABBCollidable {
    constructor(starting_lives, x, y, width, height) {
        super(x, y, width, height);
        this.last_update = 0;
        this.updates_per_second = 30;
        this.score = 0;
        this.starting_lives = starting_lives;
        const whratio = width / height;
        const rough_dim = 70;
        this.init(width, height, rough_dim, Math.floor(rough_dim * whratio));
    }
    add_snake_piece(index) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        if (view[index] !== undefined) {
            view[index] = this.snake.color.color;
            return true;
        }
        return false;
    }
    remove_snake_piece(removed) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        if (view[removed] !== undefined) {
            view[removed] = new RGB(0, 0, 0, 255).color;
            return true;
        }
        return false;
    }
    restart_game() {
        this.init(this.width, this.height, this.screen_buf.width, this.screen_buf.height);
    }
    init(width, height, cell_width, cell_height) {
        this.resize(width, height);
        this.lives = this.starting_lives;
        const color = new RGB(0, 0, 0, 255);
        this.heat_map = new Int32Array(cell_height * cell_width).fill(color.color * -1, 0, cell_height * cell_width);
        const pixels = (new Array(cell_height * cell_width)).fill(color, 0, cell_height * cell_width);
        //console.log(pixels)
        this.screen_buf = new Sprite(pixels, cell_width, cell_height, false);
        this.snake = new Snake(this, 10, Math.floor(cell_width / 2) + Math.floor(cell_height / 2) * cell_width);
        this.snake.init_snake();
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
    }
    draw(canvas, ctx, x, y, width, height) {
        const buf = new Sprite([], this.screen_buf.width, this.screen_buf.height, false);
        buf.copySprite(this.screen_buf);
        const view = new Uint32Array(buf.imageData.data.buffer);
        const blender1 = new RGB(0, 0, 0);
        //const blender2:RGB = new RGB(0, 0, 0);
        for (let i = 0; i < view.length; i++) {
            blender1.color = view[i];
            const head_x = this.snake.head_pos % this.screen_buf.width;
            const head_y = Math.floor(this.snake.head_pos / this.screen_buf.width);
            const x = i % this.screen_buf.width;
            const y = Math.floor(i / this.screen_buf.width);
            const dist = Math.abs(head_x - x) + Math.abs(head_y - y);
            const clamped_cost = dist < 255 ? dist * 4 : 255;
            const blender2 = new RGB(clamped_cost, 255 - clamped_cost, clamped_cost, 74);
            blendAlphaCopy(blender1, blender2);
            view[i] = blender1.color;
        }
        buf.refreshImage();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf.image, x, y, width, height);
    }
    update_map() {
        const view = new Int32Array(this.screen_buf.imageData.data);
        const queue = new Queue();
        queue.push(this.snake.head_pos);
        this.heat_map.fill(0, 0, this.heat_map.length);
        while (queue.length > 0) {
            const cell = queue.pop();
            if (this.heat_map[cell + 1] === 0 && view[cell + 1]) {
                this.heat_map[cell + 1] = this.heat_map[cell] + 1;
                queue.push(cell + 1);
            }
            if (this.heat_map[cell - 1] === 0 && view[cell - 1]) {
                this.heat_map[cell - 1] = this.heat_map[cell] + 1;
                queue.push(cell - 1);
            }
            if (this.heat_map[cell + this.screen_buf.width] === 0 && view[cell + this.screen_buf.width]) {
                this.heat_map[cell + this.screen_buf.width] = this.heat_map[cell] + 1;
                queue.push(cell + this.screen_buf.width);
            }
            if (this.heat_map[cell - this.screen_buf.width] === 0 && view[cell - this.screen_buf.width]) {
                this.heat_map[cell - this.screen_buf.width] = this.heat_map[cell] + 1;
                queue.push(cell - this.screen_buf.width);
            }
        }
        const color = new RGB(0, 0, 0, 255);
        this.heat_map = this.heat_map.map((cost, index, array) => {
            return new RGB(cost * 10, 0, 0, 125).color;
        });
    }
    update_state(delta_time) {
        const dt = Date.now() - this.last_update;
        if (dt > 1000 / this.updates_per_second) {
            this.last_update = Date.now();
            const runs = Math.floor(dt / (1000 / this.updates_per_second));
            console.log(runs);
            if (runs < 2000)
                for (let i = 0; i < runs; i++) {
                    this.snake.move(this);
                }
        }
    }
    move_up() {
        this.snake.direction = [0, -1];
        return true;
    }
    move_down() {
        this.snake.direction = [0, 1];
        return true;
    }
    move_left() {
        this.snake.direction = [-1, 0];
        return true;
    }
    move_right() {
        this.snake.direction = [1, 0];
        return true;
    }
}
;
const keyboardHandler = new KeyboardHandler();
async function main() {
    const canvas = document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, true, true, false);
    canvas.onmousemove = (event) => {
    };
    canvas.addEventListener("wheel", (e) => {
        //e.preventDefault();
    });
    canvas.width = getWidth();
    canvas.height = getHeight();
    canvas.style.cursor = "pointer";
    let counter = 0;
    const touchScreen = isTouchSupported();
    let height = getHeight();
    let width = getWidth();
    let game = new Game(3, 0, 0, height, width);
    window.game = game;
    let low_fps = false;
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event) => {
        switch (event.code) {
            case ("ArrowUp"):
                game.move_up();
                break;
            case ("ArrowDown"):
                game.move_down();
                break;
            case ("ArrowLeft"):
                game.move_left();
                break;
            case ("ArrowRight"):
                game.move_right();
                break;
        }
    });
    let maybectx = canvas.getContext("2d");
    if (!maybectx)
        return;
    const ctx = maybectx;
    let start = Date.now();
    let dt = 1;
    const ostart = Date.now();
    let frame_count = 0;
    let instantaneous_fps = 0;
    const time_queue = new FixedSizeQueue(60 * 2);
    const header = document.getElementById("header");
    const drawLoop = () => {
        frame_count++;
        //do stuff and render here
        if (getWidth() !== width) {
            width = getWidth();
            height = getHeight() - header.clientHeight - 150;
            game.resize(width, height);
            canvas.width = width;
            canvas.height = height;
            //game.paddle.update_state_paddle(0, game);
        }
        dt = Date.now() - start;
        time_queue.push(dt);
        start = Date.now();
        let sum = 0;
        let highest = 0;
        for (let i = 0; i < time_queue.length; i++) {
            const value = time_queue.get(i);
            sum += value;
            if (highest < value) {
                highest = value;
            }
        }
        game.update_state(dt);
        ctx.fillStyle = "#000000";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.draw(canvas, ctx, game.x, game.y, game.width, game.height);
        if (frame_count % 10 === 0)
            instantaneous_fps = Math.floor(1000 / (low_fps ? highest : dt));
        let text = "";
        ctx.fillStyle = "#FFFFFF";
        text = `avg fps: ${Math.floor(1000 * time_queue.length / sum)}, ${low_fps ? "low" : "ins"} fps: ${instantaneous_fps}`;
        const text_width = ctx.measureText(text).width;
        ctx.strokeText(text, game.width - text_width - 10, menu_font_size());
        ctx.fillText(text, game.width - text_width - 10, menu_font_size());
        requestAnimationFrame(drawLoop);
    };
    drawLoop();
    game.resize(width, height - header.clientHeight - 150);
}
main();
