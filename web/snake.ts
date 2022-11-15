import {SingleTouchListener, isTouchSupported, KeyboardHandler, TouchMoveEvent} from './io.js'
import {getHeight, getWidth, RGB, Sprite, GuiButtonFileOpener, GuiButton, SimpleGridLayoutManager, GuiTextBox} from './gui.js'
import {random, srand, max_32_bit_signed, DynamicInt32Array, saveBlob, FixedSizeQueue, Queue, PriorityQueue} from './utils.js'
import {menu_font_size, SquareAABBCollidable } from './game_utils.js'
interface ColorAndCount
{
    color:number;
    count:number;
}
class Snake {
    indexes:Queue<number>;
    non_background_color_map:Map<number, ColorAndCount>;
    direction:number[];
    color:RGB;
    game:Game;
    initial_len:number; 
    head_pos:number;
    constructor(game:Game, initial_len:number, head_pos:number)
    {
        this.game = game;
        this.init(initial_len, head_pos);
    }
    init(initial_len:number, head_pos:number):void
    {
        this.direction = [-1, 0];
        this.color = new RGB(190, 255, 40, 255);
        this.non_background_color_map = new Map<number, ColorAndCount>();
        this.initial_len = initial_len;
        this.head_pos = head_pos;
    }
    init_snake():void
    {
        this.indexes = new Queue<number>();
        for(let i = this.initial_len - 1; i >= 0; i--)
        {
            const index = this.head_pos + i;
            this.indexes.push(index);
            this.game.add_snake_piece(index);
        }
    }
    self_collision():boolean
    {
        const visited:Set<number> = new Set();
        for(let i = 0; i < this.indexes.length; i++)
        {
            const current_cell = this.indexes.get(i);
            if(!visited.has(current_cell))
                visited.add(current_cell);
            else
                return true;
        }
        //if(this.direction)
        return false;
    }
    move(game:Game):boolean
    {
        const removed = this.indexes.pop();
        //manage map that stores what lies under the snake
        if(this.non_background_color_map.has(removed))
        {
            const rec:ColorAndCount | undefined = this.non_background_color_map.get(removed);
            if(rec)
            {
                game.add_place(removed, rec.color);
                rec.count--;
                if(rec.count <= 0)
                    this.non_background_color_map.delete(removed);
            }
        }
        else
            game.clear_place(removed);
        if(this.direction[0] > 0)
        {
            const new_piece_index = this.head_pos + 1;
            if(game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[0] < 0)
        {
            const new_piece_index = this.head_pos - 1;
            if(game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[1] > 0)
        {
            const new_piece_index = this.head_pos + game.screen_buf.width;
            if(game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[1] < 0)
        {
            const new_piece_index = this.head_pos - game.screen_buf.width;
            if(game.is_snake_here(new_piece_index))
                return false;
            this.indexes.push(new_piece_index);
        }
        const screen_len = this.game.screen_buf.width * this.game.screen_buf.height;
        let new_index = this.indexes.get(this.indexes.length - 1);
        if(new_index < 0 && this.indexes.length)
        {
            this.indexes.set(this.indexes.length - 1, screen_len + new_index);
        }
        else if(new_index > screen_len && this.indexes.length)
        {
            this.indexes.set(this.indexes.length - 1, -screen_len + new_index);
        }
        this.head_pos = this.indexes.get(this.indexes.length - 1);
        if(!this.game.is_background_or_food_or_snake(this.head_pos))
        {
            this.non_background_color_map.set(this.head_pos, {color:this.game.get_place(this.head_pos)!, count:1});
        }
        if(game.is_food_here(this.head_pos))
        {
            this.game.food.forEach(food => {this.try_eat(food)});
            game.add_snake_piece(this.head_pos);
            if(this.game.ai)
                this.game.update_map();
        }
        else
        {
            game.add_snake_piece(this.head_pos);
        }
        return true;
    }
    try_eat(food:Food):boolean
    {
        if(food.index === this.head_pos)
        {
            this.game.score++;
            this.game.updates_per_second += this.game.ai ? .8 : 0.2;
            const index = this.indexes.length - 1;
            this.indexes.push(this.indexes.get(index));
            if(this.non_background_color_map.has(this.indexes.get(index)))
            {
                this.non_background_color_map.get(this.indexes.get(index))!.count++;
            }
            food.reposition(this.game);
            return true;
        }
        return false;
    }
    tail():number
    {
        return this.indexes.get(0);
    }
};
class Food {
    index:number;
    color:RGB;
    constructor(index:number, color:RGB)
    {
        this.index = index;
        this.color = color;
    }
    reposition(game:Game):void
    {
        while(game.is_snake_here(this.index) || game.is_boundary(this.index) || game.is_food_here(this.index))
        {
            this.index = Math.floor(game.screen_buf.width * game.screen_buf.height * Math.random());
        }
        game.add_place(this.index, this.color.color);
    }
};
class Game extends SquareAABBCollidable {
    screen_buf:Sprite;
    snake:Snake;
    food:Food[];
    starting_lives:number;
    lives:number;
    score:number;
    high_score:number;
    last_update:number;
    updates_per_second:number;
    heat_map:Sprite;
    cost_map:Int32Array;
    path_map:Int32Array;
    background_color:RGB;
    boundary_color:RGB;
    update_count:number;
    ai:boolean;
    paused:boolean;
    gen_heat_map:boolean;
    initial_updates_per_second:number;
    GuiFileOpener:GuiButtonFileOpener;
    GuiFileSaver:GuiButton;
    GuiTBFileName:GuiTextBox;
    GuiManager:SimpleGridLayoutManager;
    constructor(starting_lives:number, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.last_update = 0;
        this.gen_heat_map = true;
        this.paused = false;
        this.ai = true;
        this.GuiFileOpener = new GuiButtonFileOpener((binary) => this.load_binary(binary), "Load Boundary Map", 250, 50, 20);

        this.GuiFileSaver = new GuiButton(() => this.save_as(this.GuiTBFileName.text), "Save Boundary Map", 250, 50, 20);
        this.GuiTBFileName = new GuiTextBox(true, 350, this.GuiFileSaver, 20, this.GuiFileOpener.height());
        this.GuiTBFileName.setText("boundary_map_snake.bmap");
        this.GuiManager = new SimpleGridLayoutManager([300, 1], [this.GuiFileOpener.width() * 3 + this.GuiTBFileName.width(), this.GuiFileOpener.height()], 0, this.height);
        this.GuiManager.addElement(this.GuiFileOpener);
        this.GuiManager.addElement(this.GuiFileSaver);
        this.GuiManager.addElement(this.GuiTBFileName);
        this.GuiManager.activate();
        this.boundary_color = new RGB(140, 20, 200, 255);
        this.initial_updates_per_second = window.rough_dim ? 300 : 10;
        this.updates_per_second = this.initial_updates_per_second;
        this.score = 0;
        this.high_score = 0;
        this.update_count = 0;
        this.starting_lives = starting_lives;
        const whratio = width / (height > 0 ? height : width);
        const rough_dim = window.rough_dim ? window.rough_dim : 30;
        this.init(width, height, rough_dim, Math.floor(rough_dim * whratio));
        this.restart_game()
    }
    to_binary():Int32Array
    {
        const buf = new Int32Array(this.screen_buf.imageData!.data.buffer);
        const uncompressed = new DynamicInt32Array(256);
        for(let i = 0; i < buf.length; i++)
        {
            if(buf[i] == this.boundary_color.color)
                uncompressed.push(i);
        }
        return uncompressed.trimmed();
    }
    load_binary(data:Int32Array):void
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        for(let i = 0; i < view.length; i++)
        {
            //clear existing boundaries
            if(view[i] == this.boundary_color.color)
            {
                view[i] = this.background_color.color;
            }
        }
        
        for(let i = 0; i < data.length; i++)
        {
            if(data[i] < view.length && data[i] >= 0)
            {
                view[data[i]] = this.boundary_color.color;
            }
        }
    }

    save_as(name:string):void {
        saveBlob(new Blob([(this.to_binary())],{type: "application/octet-stream"}), name);
    }
    add_snake_piece(index:number):boolean
    {
        return this.add_place(index, this.snake.color.color);
    }
    add_place(index:number, color:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        if(view[index] !== undefined)
        {
            view[index] = color;
            return true;
        }
        return false;
    }
    is_background_or_food_or_snake(index:number):boolean
    {
        return this.is_background(index) || this.is_snake_here(index) || this.is_food_here(index);
    }
    is_background(index:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        return this.get_place(index) == this.background_color.color;
    }
    is_food_here(index:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        return this.get_place(index) == this.food[0].color.color;
    }
    is_boundary(index:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        return this.get_place(index) == this.boundary_color.color;
    }
    get_place(index:number):number | null
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        if(view[index] !== undefined)
        {
            return view[index];
        }
        return null;
    }
    clear_place(removed:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        if(view[removed] !== undefined)
        {
            view[removed] = this.background_color.color;
            return true;
        }
        return false;
    }
    restart_game():void
    {
        this.updates_per_second = this.initial_updates_per_second;
        this.score = 0;
        this.init(this.width, this.height, this.screen_buf.width, this.screen_buf.height);
    }
    init(width:number, height:number, cell_width:number, cell_height:number):void
    {
        this.resize(width, height);
        this.lives = this.starting_lives;
        this.ai = true;
        this.background_color = new RGB(0, 0, 0, 0);
        this.heat_map = new Sprite([], cell_width, cell_height, false);
        this.cost_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        this.path_map = new Int32Array(cell_height * cell_width).fill(0, 0, cell_height * cell_width);
        const pixels = (new Array<RGB>(cell_height * cell_width)).fill(this.background_color, 0, cell_height * cell_width);
        const old_buf = this.screen_buf;
        this.screen_buf = new Sprite(pixels, cell_width, cell_height, false);
        if(old_buf)
        {
            const view = new Int32Array(old_buf.imageData!.data.buffer);
            const view_new = new Int32Array(this.screen_buf.imageData!.data.buffer);
            for(let i = 0; i < view.length; i++)
            {
                if(!(view[i] == this.background_color.color || view[i] == this.snake.color.color))
                    view_new[i] = view[i];
            }
            this.screen_buf.refreshImage();
        }
        if(this.food)
            this.food.forEach(food => this.clear_place(food.index));
        this.food = [];
        for(let i = 0; i < (window.rough_dim ? 10 : 2); i++)
            this.food.push(new Food(Math.floor(this.screen_buf.width * this.screen_buf.height * random()), new RGB(255, 0, 0, 255))); 
        this.snake = new Snake(this, 2, Math.floor(cell_width / 2) + Math.floor(cell_height / 2) * cell_width);
        this.snake.init_snake();
        this.food.forEach(food => food.reposition(this));
    }
    resize(width:number, height:number):void
    {
        this.width = width;
        this.height = height;
    }
    draw_boundary(x1:number, x2:number, y1:number, y2:number, color:number = this.boundary_color.color, view:Int32Array = new Int32Array(this.screen_buf.imageData!.data.buffer)):void
    {
        const x_scale = 1/this.width * this.screen_buf.width;
        const y_scale = 1/this.height * this.screen_buf.height;
        x1 *= x_scale;
        x2 *= x_scale;
        y1 *= y_scale;
        y2 *= y_scale;
        //draw line from current touch pos to the touchpos minus the deltas
        //calc equation for line
        const deltaY = y2 - y1;
        const deltaX = x2 - x1;
        const m:number = deltaY/deltaX;
        const b:number = y2-m*x2;
        const delta:number = 0.1;
        if(Math.abs(deltaX) > Math.abs(deltaY))
        {
            const min:number = Math.min(x1, x2);
            const max:number = Math.max(x1, x2);
            let error:number = 0;
            for(let x = min; x < max; x++)
            {
                let y:number = Math.abs(deltaX) > 0 ? m*(x) + b : y2;
                view[Math.floor(x) + Math.floor(y) * this.screen_buf.width] = color;
            }
        }
        else
        {
            const min:number = Math.min(y1, y2);
            const max:number = Math.max(y1, y2);
            for(let y = min; y < max; y+=delta)
            {
                const x:number = Math.abs(deltaX)>0?(y - b)/m:x2;
                view[Math.floor(x) + Math.floor(y) * this.screen_buf.width] = color;
            }
        }
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void 
    {
        const buf = this.heat_map;
        const view = new Uint32Array(buf.imageData!.data.buffer);
        ctx.imageSmoothingEnabled = false;
        if(this.ai){
            let current = this.snake.head_pos;
            let iterations = 0;
            const max_it = Math.max(this.screen_buf.width, this.screen_buf.height) * 20;
            const black = new RGB(0, 0, 0, 255);
            while(!this.is_food_here(current) && iterations < max_it)
            {
                view[current] = black.color;
                current = this.path_map[current];
                iterations++;
            }
        }
        else
        {
            const color = new RGB(25, 0, 255, 160).color;
            const remainder = view.length % 8;
            const limit = view.length - remainder;
            let i = 0;
            for(; i < limit;)
            {
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
                view[i++] = color;
            }
            for(; i < view.length;)
            {
                view[i++] = color;
            }
        }
        buf.refreshImage();
        ctx.drawImage(buf.image, x, y, width, height);

        const font_size = 24;
        if(+ctx.font.split("px")[0] != font_size)
        {
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
        this.GuiManager.y = this.height;
        this.GuiManager.draw(ctx, 0, this.height);
    }
    cell_dist(cell1:number, cell2:number):number
    {
        const c1x = cell1 % this.screen_buf.width;
        const c1y = Math.floor(cell1 / this.screen_buf.width);
        const c2x = cell2 % this.screen_buf.width;
        const c2y = Math.floor(cell2 / this.screen_buf.width);
        //return (Math.abs(c1x - c2x) + Math.abs(c1y - c2y));
        return Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));
    }
    is_snake_here(cell:number):boolean
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        return view[cell] == this.snake.color.color;
    }
    calc_weight(origin:number, current:number):number
    {
        const cdist = this.cell_dist(current, this.snake.head_pos);
        return (cdist);
    }
    column(cell):number
    {
        return cell % this.screen_buf.width;
    }
    row(cell):number
    {
        return Math.floor(cell / this.screen_buf.width);
    }
    update_map():void
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        const heat_map = new Int32Array(this.heat_map.imageData!.data.buffer);
        const queue:PriorityQueue<number> = new PriorityQueue<number>((a:number, b:number) => {
            return this.cost_map[a] - this.cost_map[b];
        });
        this.food.forEach(food => queue.push(food.index));
        this.cost_map.fill(0, 0, this.cost_map.length);
        let max_cost = 1;
        let snake_parts_found = 0;
        let head_found = false;
        let cell = 0;
        while(queue.data.length > 0 && cell !== undefined)
        {
            cell = queue.pop()!;
            if(view[cell] == this.background_color.color || view[cell] == this.food[0].color.color)
            {
                if(this.cost_map[cell] > max_cost)
                {
                    max_cost = this.cost_map[cell];
                }
                if(this.cost_map[cell + 1] === 0  && this.row(cell + 1) === this.row(cell) && view[cell + 1] !== undefined)
                {
                    this.cost_map[cell + 1] = this.calc_weight(cell, cell + 1);
                    this.path_map[cell + 1] = cell;
                    queue.push(cell + 1);
                }
                if(this.cost_map[cell - 1] === 0  && this.row(cell - 1) === this.row(cell) && view[cell - 1] !== undefined)
                {
                    this.cost_map[cell - 1] = this.calc_weight(cell, cell - 1);
                    this.path_map[cell - 1] = cell;
                    queue.push(cell - 1);
                }
                if(this.cost_map[cell + this.screen_buf.width] === 0 && this.column(cell + this.screen_buf.width) === this.column(cell) && view[cell + this.screen_buf.width] !== undefined)
                {
                    this.cost_map[cell + this.screen_buf.width] = this.calc_weight(cell, cell + this.screen_buf.width);
                    this.path_map[cell + this.screen_buf.width] = cell;
                    queue.push(cell + this.screen_buf.width);
                }
                if(this.cost_map[cell - this.screen_buf.width] === 0 && this.column(cell - this.screen_buf.width) === this.column(cell) && view[cell - this.screen_buf.width] !== undefined)
                {
                    this.cost_map[cell - this.screen_buf.width] = this.calc_weight(cell, cell - this.screen_buf.width);
                    this.path_map[cell - this.screen_buf.width] = cell;
                    queue.push(cell - this.screen_buf.width);
                }
            }
            else
            {
                this.cost_map[cell] = 10000000;
                if(this.is_snake_here(cell))
                {
                    snake_parts_found++;
                    if(this.snake.head_pos == cell)
                    {
                        queue.clear();
                    }
                }
            }
        }
        const color = new RGB(0, 0, 0, 255);
        for(let i = 0; i < this.cost_map.length; i++)
        {
            const bias = this.cost_map[i] == 0 ? 255 : 0;
            const clamped_cost = this.cost_map[i] / max_cost * 255;
            const blender2 = new RGB(256 - clamped_cost, 0, bias === 0 ? 256 - clamped_cost/2 : 0, 160);
            
            if(!this.is_food_here(i))
                heat_map[i] = blender2.color;
        }
        
    }
    update_state(delta_time: number): void 
    {
        const dt = Date.now() - this.last_update;
        if(dt > 1000 / this.updates_per_second)
        {
            this.last_update = Date.now();
            if(!this.paused)
            {
                const runs = Math.floor(dt / (1000 / this.updates_per_second));
                if(runs < 1000)
                {
                    for(let i = 0; i < runs; i++)
                    {
                        this.update_count++;
    
                        if(this.ai)
                        {
                            const to_cell = this.path_map[this.snake.head_pos];
                            if(to_cell === this.snake.head_pos + 1) 
                                this.move_right();
                            else if(to_cell === this.snake.head_pos - 1) 
                                this.move_left()
                            else if(to_cell === this.snake.head_pos + this.screen_buf.width)
                                this.move_down();
                            else if(to_cell === this.snake.head_pos - this.screen_buf.width)
                                this.move_up();
                            else
                            {
                               //this.move_random();
                            }
                        }
                        if(!this.snake.move(this))
                        {
                            this.restart_game();
                        }
                    }
                    if(this.gen_heat_map && this.ai)
                        this.update_map();
                    
                    if(this.score > this.high_score)
                        this.high_score = this.score;
                }
            }
        }
    }
    move_random(depth:number = 0):void
    {
        const move = Math.floor(4 * random());
        let moved = false;
        switch(move)
        {
            case(1):
            moved = this.move_down();
            break;
            case(2):
            moved = this.move_up();
            break;
            case(3):
            moved = this.move_right();
            break;
            case(0):
            moved = this.move_left();
            break;
        }
        if(!moved && depth < 40)
        {
            this.move_random(depth++);
        }
        else if(!moved)
        {
            this.restart_game();
        }
        
    }
    move_up():boolean
    {
        if(!this.is_snake_here(this.snake.head_pos - this.screen_buf.width))
        {
            this.snake.direction = [0, -1];
            return true;
        }
        return false;
    }
    move_down():boolean
    {
        if(!this.is_snake_here(this.snake.head_pos + this.screen_buf.width))
        {
            this.snake.direction = [0, 1];
            return true;
        }
        return false;
    }
    move_left():boolean
    {
        if(!this.is_snake_here(this.snake.head_pos - 1))
        {
            this.snake.direction = [-1, 0];
            return true;
        }
        return false;
    }
    move_right():boolean
    {
        if(!this.is_snake_here(this.snake.head_pos + 1))
        {
            this.snake.direction = [1, 0];
            return true;
        }
        return false;
    }
};
const keyboardHandler = new KeyboardHandler();
async function main()
{
    const canvas:HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, true, true, false);


    canvas.onmousemove = (event:MouseEvent) => {
    };
    canvas.addEventListener("wheel", (e) => {
        //e.preventDefault();
    });
    canvas.width = getWidth();
    canvas.height = getHeight();
    canvas.style.cursor = "pointer";
    let counter = 0;
    const touchScreen:boolean = isTouchSupported();
    let height = getHeight();
    let width = getWidth();
    let game = new Game(3, 0, 0, height, width);
    window.game = game;
    let low_fps:boolean = false;
    let draw = false;
    touchListener.registerCallBack("touchstart", (event:any) => !(keyboardHandler.keysHeld["KeyB"]), (event:TouchMoveEvent) => {
       game.GuiManager.handleTouchEvents("touchstart", event);
    });
    touchListener.registerCallBack("touchend", (event:any) => !(keyboardHandler.keysHeld["KeyB"]), (event:TouchMoveEvent) => {
       game.ai = (touchListener.timeSinceLastTouch < 200);
       game.GuiManager.handleTouchEvents("touchend", event);
    });
    touchListener.registerCallBack("touchmove", (event:any) => true, (event:TouchMoveEvent) => {

        game.GuiManager.handleTouchEvents("touchmove", event);
        if(keyboardHandler.keysHeld["KeyB"] || Date.now() - event.startTouchTime > 1000)
        {
            if(keyboardHandler.keysHeld["KeyD"])
            {
                game.draw_boundary(event.touchPos[0] - event.deltaX, event.touchPos[0], event.touchPos[1] - event.deltaY, event.touchPos[1], game.background_color.color);
                return;
            }
            game.draw_boundary(event.touchPos[0] - event.deltaX, event.touchPos[0], event.touchPos[1] - event.deltaY, event.touchPos[1]);
            return;
        }
        game.ai = false;
        if(Math.abs(event.deltaX) < Math.abs(event.deltaY))
        {
            if(event.deltaY < 0)
                game.move_up();
            else
                game.move_down();
        }
        else
        {
            if(event.deltaX > 0)
                game.move_right();
            else
                game.move_left();
        }
    });
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event:any) => {
        if(!keyboardHandler.keysHeld["MetaLeft"] && !keyboardHandler.keysHeld["ControlLeft"] &&
            !keyboardHandler.keysHeld["MetaRight"] && !keyboardHandler.keysHeld["ControlRight"])
            event.preventDefault();
        switch(event.code)
        {
            case("KeyA"):
            game.ai = !game.ai;
            break;
            case("KeyP"):
            game.paused = !game.paused;
            break;
            case("KeyG"):
            game.gen_heat_map = !game.gen_heat_map;
            break;
            case("KeyL"):
            low_fps = !low_fps;
            break;
            case("ArrowUp"):
            game.move_up();
            game.ai = false;
            break;
            case("ArrowDown"):
            game.move_down();
            game.ai = false;
            break;
            case("ArrowLeft"):
            game.move_left();
            game.ai = false;
            break;
            case("ArrowRight"):
            game.move_right();
            game.ai = false;
            break;
        }
    });
    let maybectx:CanvasRenderingContext2D | null = canvas.getContext("2d");
    if(!maybectx)
        return;
    const ctx:CanvasRenderingContext2D = maybectx;
    let start = Date.now();
    let dt = 1;
    const ostart = Date.now();
    let frame_count = 0;
    let instantaneous_fps = 0;
    const time_queue:FixedSizeQueue<number> = new FixedSizeQueue<number>(60 * 2);
    const header = document.getElementById("header");
    srand(Math.random() * max_32_bit_signed);


    const drawLoop = () => 
    {
        frame_count++;
        //do stuff and render here
        if(getWidth() !== width)
        {
            width = getWidth();
            height = getHeight() - header!.clientHeight - 150;
            game.resize(width, height);
            canvas.width = width;
            canvas.height = height;
        }
        dt = Date.now() - start;
        time_queue.push(dt);
        start = Date.now();
        let sum = 0;
        let highest = 0;
        for(let i = 0; i < time_queue.length; i++)
        {
            const value = time_queue.get(i);
            sum += value;
            if(highest < value)
            {
                highest = value;
            }
        }
        game.update_state(dt);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.draw(canvas, ctx, game.x, game.y, game.width, game.height);
        if(frame_count % 10 === 0)
            instantaneous_fps = Math.floor(1000 / (low_fps?highest:dt));
        let text = "";
        ctx.fillStyle = "#FFFFFF";
        text = `avg fps: ${Math.floor(1000 * time_queue.length / sum)}, ${low_fps?"low":"ins"} fps: ${instantaneous_fps}`;
        const text_width = ctx.measureText(text).width;
        ctx.strokeText(text, game.width - text_width - 10, menu_font_size());
        ctx.fillText(text, game.width - text_width - 10, menu_font_size());

        requestAnimationFrame(drawLoop);
    }
    drawLoop();
    game.resize(width, height - header!.clientHeight - 150);

}
main();





