import { SingleTouchListener, isTouchSupported, KeyboardHandler } from './io.js';
import { getHeight, getWidth, RGB, Sprite } from './gui.js';
import { random, srand, max_32_bit_signed, FixedSizeQueue, Queue } from './utils.js';
import { menu_font_size, SquareAABBCollidable } from './game_utils.js';
class Snake {
    constructor(game, initial_len, head_pos) {
        this.game = game;
        this.init(initial_len, head_pos);
    }
    init(initial_len, head_pos) {
        this.direction = [-1, 0];
        this.color = new RGB(255, 255, 255, 255);
        this.initial_len = initial_len;
        this.head_pos = head_pos;
    }
    init_snake() {
        this.indexes = new Queue();
        for (let i = this.initial_len - 1; i >= 0; i--) {
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
        game.clear_place(removed);
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
    try_eat(food) {
        if (food.index === this.head_pos) {
            this.game.score++;
            this.game.updates_per_second += 0.1;
            while (this.indexes.indexOf(food.index) !== -1)
                food.index = Math.floor(this.game.screen_buf.width * this.game.screen_buf.height * random());
            this.game.add_place(food.index, food.color.color);
            if (this.indexes.indexOf(this.indexes.get(0) + 1) === -1) {
                this.indexes.push(this.indexes.get(0) + 1);
            }
            else if (this.indexes.indexOf(this.indexes.get(0) - 1) === -1) {
                this.indexes.push(this.indexes.get(0) - 1);
            }
            else if (this.indexes.indexOf(this.indexes.get(0) + this.game.screen_buf.width) === -1) {
                this.indexes.push(this.indexes.get(0) + this.game.screen_buf.width);
            }
            else if (this.indexes.indexOf(this.indexes.get(0) - this.game.screen_buf.width) === -1) {
                this.indexes.push(this.indexes.get(0) - this.game.screen_buf.width);
            }
        }
    }
}
;
class Food {
    constructor(index, color) {
        this.index = index;
        this.color = color;
    }
}
;
class Game extends SquareAABBCollidable {
    constructor(starting_lives, x, y, width, height) {
        super(x, y, width, height);
        this.last_update = 0;
        this.updates_per_second = 7;
        this.score = 0;
        this.update_count = 0;
        this.starting_lives = starting_lives;
        const whratio = width / height;
        const rough_dim = 40;
        this.ai = true;
        this.init(width, height, rough_dim, Math.floor(rough_dim * whratio));
    }
    add_snake_piece(index) {
        return this.add_place(index, this.snake.color.color);
    }
    add_place(index, color) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        if (view[index] !== undefined) {
            view[index] = color;
            return true;
        }
        return false;
    }
    clear_place(removed) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        if (view[removed] !== undefined) {
            view[removed] = this.background_color.color;
            return true;
        }
        return false;
    }
    restart_game() {
        this.updates_per_second = 7;
        this.init(this.width, this.height, this.screen_buf.width, this.screen_buf.height);
    }
    init(width, height, cell_width, cell_height) {
        this.resize(width, height);
        this.lives = this.starting_lives;
        this.background_color = new RGB(0, 0, 0, 255);
        this.heat_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        this.cost_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        const pixels = (new Array(cell_height * cell_width)).fill(this.background_color, 0, cell_height * cell_width);
        this.screen_buf = new Sprite(pixels, cell_width, cell_height, false);
        this.food = new Food(Math.floor(this.screen_buf.width * this.screen_buf.height * random()), new RGB(255, 0, 0, 255));
        this.add_place(this.food.index, this.food.color.color);
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
        const blender2 = new RGB(0, 0, 0);
        for (let i = 0; i < view.length; i++) {
            blender1.color = view[i];
            blender2.color = this.heat_map[i];
            blender1.blendAlphaCopy(blender2);
            view[i] = blender1.color;
        }
        buf.refreshImage();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf.image, x, y, width, height);
    }
    cell_dist(cell1, cell2) {
        const c1x = cell1 % this.screen_buf.width;
        const c1y = Math.floor(cell1 / this.screen_buf.width);
        const c2x = cell2 % this.screen_buf.width;
        const c2y = Math.floor(cell2 / this.screen_buf.width);
        return (Math.abs(c1x - c2x) + Math.abs(c1y - c2y));
    }
    is_snake_here(cell) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        return view[cell] == this.snake.color.color;
    }
    calc_weight(origin, current) {
        let weight = this.cost_map[origin] + 1 + this.cell_dist(current, this.food.index);
        const y = Math.floor(current / this.screen_buf.width);
        weight += +((y === this.screen_buf.height || y === 0) && current != this.food.index) * 200;
        return weight;
    }
    update_map() {
        const view = new Int32Array(this.screen_buf.imageData.data);
        const queue = new Queue();
        queue.push(this.snake.head_pos);
        this.cost_map.fill(0, 0, this.cost_map.length);
        let max_cost = 0;
        const blender1 = new RGB(0, 0, 0);
        while (queue.length > 0) {
            const cell = queue.pop();
            if (!this.is_snake_here(cell) || cell == this.snake.head_pos) {
                if (this.cost_map[cell] > max_cost) {
                    max_cost = this.cost_map[cell];
                }
                if (this.cost_map[cell + 1] === 0 && view[cell + 1] !== undefined) {
                    this.cost_map[cell + 1] = this.calc_weight(cell, cell + 1);
                    queue.push(cell + 1);
                }
                if (this.cost_map[cell - 1] === 0 && view[cell - 1] !== undefined) {
                    this.cost_map[cell - 1] = this.calc_weight(cell, cell - 1);
                    queue.push(cell - 1);
                }
                if (this.cost_map[cell + this.screen_buf.width] === 0 && view[cell + this.screen_buf.width] !== undefined) {
                    this.cost_map[cell + this.screen_buf.width] = this.calc_weight(cell, cell + this.screen_buf.width);
                    queue.push(cell + this.screen_buf.width);
                }
                if (this.cost_map[cell - this.screen_buf.width] === 0 && view[cell - this.screen_buf.width] !== undefined) {
                    this.cost_map[cell - this.screen_buf.width] = this.calc_weight(cell, cell - this.screen_buf.width);
                    queue.push(cell - this.screen_buf.width);
                }
            }
            else {
                this.cost_map[cell] = 1000000;
            }
        }
        const color = new RGB(0, 0, 0, 255);
        for (let i = 0; i < this.cost_map.length; i++) {
            const clamped_cost = this.cost_map[i] / max_cost * 255;
            const blender2 = new RGB(clamped_cost, 255 - clamped_cost, clamped_cost, 74);
            this.heat_map[i] = blender2.color;
        }
    }
    update_state(delta_time) {
        const dt = Date.now() - this.last_update;
        if (dt > 1000 / this.updates_per_second) {
            this.last_update = Date.now();
            const runs = Math.floor(dt / (1000 / this.updates_per_second));
            if (runs < 2000)
                for (let i = 0; i < runs; i++) {
                    this.update_count++;
                    if (this.update_count % 1 === 0) {
                        this.update_map();
                        if (this.ai) {
                            const min_weight = Math.min(this.cost_map[this.snake.head_pos + 1], // + this.snake.indexes.indexOf(this.snake.head_pos + 1) > -1 ? 5000:0,
                            this.cost_map[this.snake.head_pos - 1], // + this.snake.indexes.indexOf(this.snake.head_pos - 1) > -1 ? 5000:0,
                            this.cost_map[this.snake.head_pos + this.screen_buf.width], // + this.snake.indexes.indexOf(this.snake.head_pos + this.screen_buf.width) > -1 ? 5000:0,
                            this.cost_map[this.snake.head_pos - this.screen_buf.width]);
                            if (min_weight === this.cost_map[this.snake.head_pos + 1])
                                this.move_right();
                            else if (min_weight === this.cost_map[this.snake.head_pos - 1])
                                this.move_left();
                            else if (min_weight === this.cost_map[this.snake.head_pos + this.screen_buf.width])
                                this.move_down();
                            else if (min_weight === this.cost_map[this.snake.head_pos - this.screen_buf.width])
                                this.move_up();
                            else {
                                this.move_random();
                            }
                        }
                    }
                    if (this.snake.self_collision()) {
                        this.restart_game();
                    }
                    this.snake.move(this);
                    this.snake.try_eat(this.food);
                }
        }
    }
    move_random(depth = 0) {
        const move = Math.floor(4 * random());
        let moved = false;
        switch (move) {
            case (1):
                moved = this.move_down();
                break;
            case (2):
                moved = this.move_up();
                break;
            case (3):
                moved = this.move_right();
                break;
            case (0):
                moved = this.move_left();
                break;
        }
        if (!moved && depth < 40) {
            this.move_random(depth++);
        }
        else if (!moved) {
            this.restart_game();
        }
    }
    move_up() {
        if (!this.is_snake_here(this.snake.head_pos - this.screen_buf.width)) {
            this.snake.direction = [0, -1];
            return true;
        }
        return false;
    }
    move_down() {
        if (!this.is_snake_here(this.snake.head_pos + this.screen_buf.width)) {
            this.snake.direction = [0, 1];
            return true;
        }
        return false;
    }
    move_left() {
        if (!this.is_snake_here(this.snake.head_pos - 1)) {
            this.snake.direction = [-1, 0];
            return true;
        }
        return false;
    }
    move_right() {
        if (!this.is_snake_here(this.snake.head_pos + 1)) {
            this.snake.direction = [1, 0];
            return true;
        }
        return false;
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
    touchListener.registerCallBack("touchmove", (event) => true, (event) => {
        game.ai = false;
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            if (event.deltaY < 0)
                game.move_up();
            else
                game.move_down();
        }
        else {
            if (event.deltaX > 0)
                game.move_right();
            else
                game.move_left();
        }
    });
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event) => {
        switch (event.code) {
            case ("KeyA"):
                game.ai = !game.ai;
            case ("KeyL"):
                low_fps = !low_fps;
                break;
            case ("ArrowUp"):
                game.move_up();
                game.ai = false;
                break;
            case ("ArrowDown"):
                game.move_down();
                game.ai = false;
                break;
            case ("ArrowLeft"):
                game.move_left();
                game.ai = false;
                break;
            case ("ArrowRight"):
                game.move_right();
                game.ai = false;
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
    srand(Math.random() * max_32_bit_signed);
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
