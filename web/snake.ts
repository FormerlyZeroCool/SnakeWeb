import {SingleTouchListener, TouchMoveEvent, MouseDownTracker, isTouchSupported, KeyboardHandler} from './io.js'
import {RegularPolygon, getHeight, getWidth, RGB, Sprite, blendAlphaCopy} from './gui.js'
import {random, srand, max_32_bit_signed, FixedSizeQueue, Queue, PriorityQueue} from './utils.js'
import {non_elastic_no_angular_momentum_bounce_vector, get_normal_vector_aabb_rect_circle_collision, magnitude, dot_product_2d, scalar_product_2d, normalize2D, distance, GameObject, menu_font_size, SpatiallyMappableCircle, SpatialHashMap2D, SquareAABBCollidable, Circle, manhattan_distance } from './game_utils.js'
class Snake {
    indexes:Queue<number>;
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
        this.color = new RGB(255, 255, 255, 255);
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
        return false;
    }
    move(game:Game):void
    {
        const removed = this.indexes.pop();
        game.clear_place(removed)
        if(this.direction[0] > 0)
        {
            const new_piece_index = this.head_pos + 1;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[0] < 0)
        {
            const new_piece_index = this.head_pos - 1;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[1] > 0)
        {
            const new_piece_index = this.head_pos + game.screen_buf.width;
            this.indexes.push(new_piece_index);
        }
        else if(this.direction[1] < 0)
        {
            const new_piece_index = this.head_pos - game.screen_buf.width;
            this.indexes.push(new_piece_index);
        }
        const screen_len = this.game.screen_buf.width * this.game.screen_buf.height;
        let new_index = this.indexes.get(this.indexes.length - 1);
        if(new_index < 0 && this.indexes.length)
        {
            this.indexes.set(this.indexes.length - 1, screen_len - new_index);
        }
        else if(new_index > screen_len && this.indexes.length)
        {
            this.indexes.set(this.indexes.length - 1, -screen_len + new_index);
        }
        this.head_pos = this.indexes.get(this.indexes.length - 1);
        game.add_snake_piece(this.head_pos);
    }
    try_eat(food:Food):void
    {
        if(food.index === this.head_pos)
        {
            this.game.score++;
            this.game.updates_per_second += this.game.ai ? 2 : 0.2;
            if(this.indexes.indexOf(this.indexes.get(0) + 1) === -1)
            {
                this.indexes.push_front(this.indexes.get(0) + 1);
            }
            else if(this.indexes.indexOf(this.indexes.get(0) - 1) === -1)
            {
                this.indexes.push_front(this.indexes.get(0) - 1);
            }
            else if(this.indexes.indexOf(this.indexes.get(0) + this.game.screen_buf.width) === -1)
            {
                this.indexes.push_front(this.indexes.get(0) + this.game.screen_buf.width);
            }
            else if(this.indexes.indexOf(this.indexes.get(0) - this.game.screen_buf.width) === -1)
            {
                this.indexes.push_front(this.indexes.get(0) - this.game.screen_buf.width);
            }
            this.game.add_snake_piece(this.indexes.get(this.indexes.length - 1));
            this.game.food.reposition(this.game);

        }
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
        while(game.snake.indexes.indexOf(game.food.index) !== -1)
        {
            game.food.index = Math.floor(game.snake.game.screen_buf.width * game.snake.game.screen_buf.height * Math.random());
        }
        
        game.snake.game.add_place(game.food.index, game.food.color.color);
    }
};
class Game extends SquareAABBCollidable {
    screen_buf:Sprite;
    snake:Snake;
    food:Food;
    starting_lives:number;
    lives:number;
    score:number;
    last_update:number;
    updates_per_second:number;
    heat_map:Sprite;
    cost_map:Int32Array;
    path_map:Int32Array;
    background_color:RGB;
    update_count:number;
    ai:boolean;
    gen_heat_map:boolean;
    initial_updates_per_second:number;
    constructor(starting_lives:number, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.last_update = 0;
        this.gen_heat_map = true;
        this.ai = true;
        this.initial_updates_per_second = window.rough_dim ? 300 : 17;
        this.updates_per_second = this.initial_updates_per_second;
        this.score = 0;
        this.update_count = 0;
        this.starting_lives = starting_lives;
        const whratio = width / (height > 0 ? height : width);
        const rough_dim = window.rough_dim ? window.rough_dim : 100;
        this.init(width, height, rough_dim, Math.floor(rough_dim * whratio));
        this.restart_game()
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
        this.screen_buf = new Sprite(pixels, cell_width, cell_height, false);
        
        this.food = new Food(Math.floor(this.screen_buf.width * this.screen_buf.height * random()), new RGB(255, 0, 0, 255));   
        this.snake = new Snake(this, 20, Math.floor(cell_width / 2) + Math.floor(cell_height / 2) * cell_width);
        this.snake.init_snake();

        this.food.reposition(this);
    }
    resize(width:number, height:number):void
    {
        this.width = width;
        this.height = height;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void 
    {
        const buf = this.heat_map;
        const view = new Uint32Array(buf.imageData!.data.buffer);
        this.screen_buf.refreshImage();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf.image, x, y, width, height);
        if(this.ai){
            let current = this.snake.head_pos;
            let iterations = 0;
            const max_it = Math.max(this.screen_buf.width, this.screen_buf.height) * 2;
            const black = new RGB(0, 0, 0, 255);
            while(current !== this.food.index && iterations < max_it)
            {
                view[current] = black.color;
                current = this.path_map[current];
                iterations++;
            }
            buf.refreshImage();
            ctx.drawImage(this.screen_buf.image, x, y, width, height);
        }
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
        const odist = this.cell_dist(origin, this.snake.head_pos);
        const fdist = this.cell_dist(current, this.food.index);
        let weight = cdist + this.cell_dist(current, this.food.index)//(cdist >= odist ? 1 : 0.5)  + this.cost_map[origin]//cdist + this.cell_dist(current, this.food.index)// + this.cost_map[origin];//this.cost_map[origin] + 1 + cdist + (cdist > this.cost_map[origin]?1:0);
        //weight += +(this.is_snake_here(current) && current !== this.snake.head_pos) * 5;
        return weight;
    }
    column(cell):number
    {
        return cell % this.screen_buf.width;
    }
    row(cell):number
    {
        return Math.floor(cell / this.screen_buf.width);
    }
    update_map(start:number = this.food.index):void
    {
        const view = new Int32Array(this.screen_buf.imageData!.data.buffer);
        const heat_map = new Int32Array(this.heat_map.imageData!.data.buffer);
        const queue:PriorityQueue<number> = new PriorityQueue<number>((a:number, b:number) => {
            return this.cost_map[a] - this.cost_map[b];
        });
        queue.push(start);
        this.cost_map.fill(0, 0, this.cost_map.length);
        let max_cost = 1;
        let snake_parts_found = 0;
        let head_found = false;
        let cell = 0;
        while(queue.data.length > 0 && cell !== undefined)
        {
            cell = queue.pop();
            if(view[cell] == this.background_color.color || view[cell] == this.food.color.color)
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
            const bias = this.cost_map[i] == 0 ? 125 : 0;
            const clamped_cost = this.cost_map[i] / max_cost * 150;
            const blender2 = new RGB(clamped_cost, bias === 0 ? 150 - clamped_cost : 0, Math.abs(clamped_cost - bias), 200);
            if(i !== this.food.index)
                heat_map[i] = blender2.color;
        }
        
    }
    update_state(delta_time: number): void 
    {
        const dt = Date.now() - this.last_update;
        if(dt > 1000 / this.updates_per_second)
        {
            this.last_update = Date.now();
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
                    if(this.snake.self_collision())
                    {
                        this.restart_game();
                    }
                    this.snake.try_eat(this.food);
                    this.snake.move(this);
                }
                if(this.gen_heat_map)
                    this.update_map();
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
    touchListener.registerCallBack("touchmove", (event:any) => true, (event:any) => {
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
            //game.paddle.update_state_paddle(0, game);
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
        ctx.fillStyle = "#000000";
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





