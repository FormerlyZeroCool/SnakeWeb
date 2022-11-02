import { SingleTouchListener, isTouchSupported, KeyboardHandler } from './io.js';
import { getHeight, getWidth, RGB, Sprite } from './gui.js';
import { random, srand, max_32_bit_signed, FixedSizeQueue, Queue, PriorityQueue } from './utils.js';
import { menu_font_size, SquareAABBCollidable } from './game_utils.js';
class Snake {
    constructor(game, initial_len, head_pos) {
        this.game = game;
        this.init(initial_len, head_pos);
    }
    init(initial_len, head_pos) {
        this.direction = [-1, 0];
        this.color = new RGB(190, 255, 40, 255);
        this.initial_len = initial_len;
        this.head_pos = head_pos;
    }
    init_snake() {
        this.indexes = new Queue();
        this.index_map = new Set();
        for (let i = this.initial_len - 1; i >= 0; i--) {
            const index = this.head_pos + i;
            this.indexes.push(index);
            this.index_map.add(index);
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
        if (this.directio)
            return false;
    }
    move(game) {
        const removed = this.indexes.pop();
        this.index_map.delete(removed);
        game.clear_place(removed);
        if (this.direction[0] > 0) {
            const new_piece_index = this.head_pos + 1;
            if (game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[0] < 0) {
            const new_piece_index = this.head_pos - 1;
            if (game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[1] > 0) {
            const new_piece_index = this.head_pos + game.screen_buf.width;
            if (game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if (this.direction[1] < 0) {
            const new_piece_index = this.head_pos - game.screen_buf.width;
            if (game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        const screen_len = this.game.screen_buf.width * this.game.screen_buf.height;
        let new_index = this.indexes.get(this.indexes.length - 1);
        this.index_map.add(new_index);
        if (new_index < 0 && this.indexes.length) {
            this.indexes.set(this.indexes.length - 1, screen_len - new_index);
        }
        else if (new_index > screen_len && this.indexes.length) {
            this.indexes.set(this.indexes.length - 1, -screen_len + new_index);
        }
        this.head_pos = this.indexes.get(this.indexes.length - 1);
        game.add_snake_piece(this.head_pos);
        return true;
    }
    try_eat(food) {
        if (food.index === this.head_pos) {
            this.game.score++;
            this.game.updates_per_second += this.game.ai ? 2 : 0.2;
            if (!this.index_map.has(this.indexes.get(0) + 1)) {
                this.indexes.push_front(this.indexes.get(0) + 1);
            }
            else if (!this.index_map.has(this.indexes.get(0) - 1)) {
                this.indexes.push_front(this.indexes.get(0) - 1);
            }
            else if (!this.index_map.has(this.indexes.get(0) + this.game.screen_buf.width)) {
                this.indexes.push_front(this.indexes.get(0) + this.game.screen_buf.width);
            }
            else if (!this.index_map.has(this.indexes.get(0) - this.game.screen_buf.width)) {
                this.indexes.push_front(this.indexes.get(0) - this.game.screen_buf.width);
            }
            this.game.add_snake_piece(this.indexes.get(this.indexes.length - 1));
            this.index_map.add(this.indexes.get(this.indexes.length - 1));
            this.game.food.reposition(this.game);
            return true;
        }
        return false;
    }
    tail() {
        return this.indexes.get(0);
    }
}
;
class Food {
    constructor(index, color) {
        this.index = index;
        this.color = color;
    }
    reposition(game) {
        while (game.snake.indexes.indexOf(game.food.index) !== -1) {
            game.food.index = Math.floor(game.snake.game.screen_buf.width * game.snake.game.screen_buf.height * Math.random());
        }
        game.snake.game.add_place(game.food.index, game.food.color.color);
    }
}
;
class Game extends SquareAABBCollidable {
    constructor(starting_lives, x, y, width, height) {
        super(x, y, width, height);
        this.last_update = 0;
        this.gen_heat_map = true;
        this.ai = true;
        this.initial_updates_per_second = window.rough_dim ? 300 : 17;
        this.updates_per_second = this.initial_updates_per_second;
        this.score = 0;
        this.high_score = 0;
        this.update_count = 0;
        this.starting_lives = starting_lives;
        const whratio = width / (height > 0 ? height : width);
        const rough_dim = window.rough_dim ? window.rough_dim : 50;
        this.init(width, height, rough_dim, Math.floor(rough_dim * whratio));
        this.restart_game();
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
        this.updates_per_second = this.initial_updates_per_second;
        this.score = 0;
        this.init(this.width, this.height, this.screen_buf.width, this.screen_buf.height);
    }
    init(width, height, cell_width, cell_height) {
        this.resize(width, height);
        this.lives = this.starting_lives;
        this.ai = true;
        this.background_color = new RGB(0, 0, 0, 0);
        this.heat_map = new Sprite([], cell_width, cell_height, false);
        this.cost_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        this.path_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        const pixels = (new Array(cell_height * cell_width)).fill(this.background_color, 0, cell_height * cell_width);
        this.screen_buf = new Sprite(pixels, cell_width, cell_height, false);
        this.food = new Food(Math.floor(this.screen_buf.width * this.screen_buf.height * random()), new RGB(255, 0, 0, 255));
        this.snake = new Snake(this, 2, Math.floor(cell_width / 2) + Math.floor(cell_height / 2) * cell_width);
        this.snake.init_snake();
        this.food.reposition(this);
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
    }
    draw(canvas, ctx, x, y, width, height) {
        const buf = this.heat_map;
        const view = new Uint32Array(buf.imageData.data.buffer);
        ctx.imageSmoothingEnabled = false;
        if (this.ai) {
            let current = this.snake.head_pos;
            let iterations = 0;
            const max_it = Math.max(this.screen_buf.width, this.screen_buf.height) * 2;
            const black = new RGB(0, 0, 0, 255);
            while (current !== this.food.index && iterations < max_it) {
                view[current] = black.color;
                current = this.path_map[current];
                iterations++;
            }
        }
        else {
            const color = new RGB(25, 0, 255, 160).color;
            const remainder = view.length % 8;
            const limit = view.length - remainder;
            for (let i = 0; i < limit;) {
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
            }
            for (let i = 0; i < remainder;) {
                view[i++] = color;
            }
        }
        buf.refreshImage();
        ctx.drawImage(buf.image, x, y, width, height);
        const font_size = 24;
        if (+ctx.font.split("px")[0] != font_size) {
            ctx.font = `${font_size}px Helvetica`;
        }
        const text = `Score: ${this.score} High Score: ${this.high_score}`;
        const max_width = Math.floor(width / 2) - 20;
        ctx.strokeText(text, 25, font_size, max_width);
        ctx.fillText(text, 25, font_size, max_width);
        {
            const text = `Speed updates per sec: ${Math.round(this.updates_per_second * 10) / 10}`;
            const max_width = Math.floor(width / 2) - 20;
            ctx.strokeText(text, 25, font_size * 2, max_width);
            ctx.fillText(text, 25, font_size * 2, max_width);
        }
        this.screen_buf.refreshImage();
        ctx.drawImage(this.screen_buf.image, x, y, width, height);
    }
    cell_dist(cell1, cell2) {
        const c1x = cell1 % this.screen_buf.width;
        const c1y = Math.floor(cell1 / this.screen_buf.width);
        const c2x = cell2 % this.screen_buf.width;
        const c2y = Math.floor(cell2 / this.screen_buf.width);
        //return (Math.abs(c1x - c2x) + Math.abs(c1y - c2y));
        return Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));
    }
    is_snake_here(cell) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        return view[cell] == this.snake.color.color;
    }
    calc_weight(origin, current) {
        const cdist = this.cell_dist(current, this.snake.head_pos);
        return cdist;
    }
    column(cell) {
        return cell % this.screen_buf.width;
    }
    row(cell) {
        return Math.floor(cell / this.screen_buf.width);
    }
    update_map(start = this.food.index) {
        const view = new Int32Array(this.screen_buf.imageData.data.buffer);
        const heat_map = new Int32Array(this.heat_map.imageData.data.buffer);
        const queue = new PriorityQueue((a, b) => {
            return this.cost_map[a] - this.cost_map[b];
        });
        queue.push(start);
        this.cost_map.fill(0, 0, this.cost_map.length);
        let max_cost = 1;
        let snake_parts_found = 0;
        let head_found = false;
        let cell = 0;
        while (queue.data.length > 0 && cell !== undefined) {
            cell = queue.pop();
            if (view[cell] == this.background_color.color || view[cell] == this.food.color.color) {
                if (this.cost_map[cell] > max_cost) {
                    max_cost = this.cost_map[cell];
                }
                if (this.cost_map[cell + 1] === 0 && this.row(cell + 1) === this.row(cell) && view[cell + 1] !== undefined) {
                    this.cost_map[cell + 1] = this.calc_weight(cell, cell + 1);
                    this.path_map[cell + 1] = cell;
                    queue.push(cell + 1);
                }
                if (this.cost_map[cell - 1] === 0 && this.row(cell - 1) === this.row(cell) && view[cell - 1] !== undefined) {
                    this.cost_map[cell - 1] = this.calc_weight(cell, cell - 1);
                    this.path_map[cell - 1] = cell;
                    queue.push(cell - 1);
                }
                if (this.cost_map[cell + this.screen_buf.width] === 0 && this.column(cell + this.screen_buf.width) === this.column(cell) && view[cell + this.screen_buf.width] !== undefined) {
                    this.cost_map[cell + this.screen_buf.width] = this.calc_weight(cell, cell + this.screen_buf.width);
                    this.path_map[cell + this.screen_buf.width] = cell;
                    queue.push(cell + this.screen_buf.width);
                }
                if (this.cost_map[cell - this.screen_buf.width] === 0 && this.column(cell - this.screen_buf.width) === this.column(cell) && view[cell - this.screen_buf.width] !== undefined) {
                    this.cost_map[cell - this.screen_buf.width] = this.calc_weight(cell, cell - this.screen_buf.width);
                    this.path_map[cell - this.screen_buf.width] = cell;
                    queue.push(cell - this.screen_buf.width);
                }
            }
            else {
                this.cost_map[cell] = 10000000;
                if (this.is_snake_here(cell)) {
                    snake_parts_found++;
                    if (this.snake.head_pos == cell) {
                        queue.clear();
                    }
                }
            }
        }
        const color = new RGB(0, 0, 0, 255);
        for (let i = 0; i < this.cost_map.length; i++) {
            const bias = this.cost_map[i] == 0 ? 255 : 0;
            const clamped_cost = this.cost_map[i] / max_cost * 255;
            const blender2 = new RGB(clamped_cost, bias === 0 ? 255 - clamped_cost : 0, Math.abs(clamped_cost - bias), 160);
            if (i !== this.food.index)
                heat_map[i] = blender2.color;
        }
    }
    update_state(delta_time) {
        const dt = Date.now() - this.last_update;
        if (dt > 1000 / this.updates_per_second) {
            this.last_update = Date.now();
            const runs = Math.floor(dt / (1000 / this.updates_per_second));
            if (runs < 1000) {
                for (let i = 0; i < runs; i++) {
                    this.update_count++;
                    if (this.ai) {
                        const to_cell = this.path_map[this.snake.head_pos];
                        if (to_cell === this.snake.head_pos + 1)
                            this.move_right();
                        else if (to_cell === this.snake.head_pos - 1)
                            this.move_left();
                        else if (to_cell === this.snake.head_pos + this.screen_buf.width)
                            this.move_down();
                        else if (to_cell === this.snake.head_pos - this.screen_buf.width)
                            this.move_up();
                        else {
                            //this.move_random();
                        }
                    }
                    if (!this.snake.move(this)) {
                        this.restart_game();
                    }
                    const eaten = this.snake.try_eat(this.food);
                    if (this.gen_heat_map && eaten)
                        this.update_map();
                }
                if (this.gen_heat_map)
                    this.update_map();
                if (this.score > this.high_score)
                    this.high_score = this.score;
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
        if (!keyboardHandler.keysHeld["MetaLeft"] && !keyboardHandler.keysHeld["ControlLeft"] &&
            !keyboardHandler.keysHeld["MetaRight"] && !keyboardHandler.keysHeld["ControlRight"])
            event.preventDefault();
        switch (event.code) {
            case ("KeyA"):
                game.ai = !game.ai;
                break;
            case ("KeyG"):
                game.gen_heat_map = !game.gen_heat_map;
                break;
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
