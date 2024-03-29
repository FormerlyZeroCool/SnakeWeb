import {SingleTouchListener, isTouchSupported, KeyboardHandler, fetchImage} from './io.js'
import { max_32_bit_signed, sleep } from './utils.js';

export function blendAlphaCopy(color0:RGB, color:RGB):void
{
    const alphant:number = color0.alphaNormal();
    const alphanc:number = color.alphaNormal();
    const a:number = (1 - alphanc);
    const a0:number = (alphanc + alphant * a);
    const a1:number = 1 / a0;
    color0.color = (((alphanc * color.red() + alphant * color0.red() * a) * a1)) |
        (((alphanc * color.green() + alphant * color0.green() * a) * a1) << 8) | 
        (((alphanc * color.blue() +  alphant * color0.blue() * a) * a1) << 16) |
        ((a0 * 255) << 24);
    /*this.setRed  ((alphanc*color.red() +   alphant*this.red() * a ) *a1);
    this.setBlue ((alphanc*color.blue() +  alphant*this.blue() * a) *a1);
    this.setGreen((alphanc*color.green() + alphant*this.green() * a)*a1);
    this.setAlpha(a0*255);*/
}
export class RGB {
    color:number;
    constructor(r:number = 0, g:number = 0, b:number, a:number = 0)
    {
        this.color = 0;
        this.color = a << 24 | b << 16 | g << 8 | r;
    }
    blendAlphaCopy(color:RGB):void
    {
        blendAlphaCopy(this, color);
        /*this.setRed  ((alphanc*color.red() +   alphant*this.red() * a ) *a1);
        this.setBlue ((alphanc*color.blue() +  alphant*this.blue() * a) *a1);
        this.setGreen((alphanc*color.green() + alphant*this.green() * a)*a1);
        this.setAlpha(a0*255);*/
    }
    toHSL():number[]//[hue, saturation, lightness]
    {
        const normRed:number = this.red() / 255;
        const normGreen:number = this.green() / 255;
        const normBlue:number = this.blue() / 255;
        const cMax:number = Math.max(normBlue, normGreen, normRed);
        const cMin:number = Math.min(normBlue, normGreen, normRed);
        const delta:number = cMax - cMin;
        let hue:number = 0;
        if(delta !== 0)
        {
            if(cMax === normRed)
            {
                hue = 60 * ((normGreen - normBlue) / delta % 6);
            }
            else if(cMax === normGreen)
            {
                hue = 60 * ((normBlue - normRed) / delta + 2);
            }
            else
            {
                hue = 60 * ((normRed - normGreen) / delta + 4);
            }
        }
        const lightness:number = (cMax + cMin) / 2;
        const saturation:number = delta / (1 - Math.abs(2*lightness - 1));
        return [hue, saturation, lightness];
    }
    setByHSL(hue:number, saturation:number, lightness:number): void
    {
        const c:number = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x:number = c * (1 - Math.abs(hue / 60 % 2 - 1));
        const m:number = lightness - c / 2;
        if(hue < 60)
        {
            this.setRed((c + m) * 255);
            this.setGreen((x + m) * 255);
            this.setBlue(0);
        }
        else if(hue < 120)
        {
            this.setRed((x + m) * 255);
            this.setGreen((c + m) * 255);
            this.setBlue(m * 255);
        }
        else if(hue < 180)
        {
            this.setRed(m * 255);
            this.setGreen((c + m) * 255);
            this.setBlue((x + m) * 255);
        }
        else if(hue < 240)
        {
            this.setRed(0);
            this.setGreen((x + m) * 255);
            this.setBlue((c + m) * 255);
        }
        else if(hue < 300)
        {
            this.setRed((x + m) * 255);
            this.setGreen(m * 255);
            this.setBlue((c + m) * 255);
        }
        else
        {
            this.setRed((c + m) * 255);
            this.setGreen(m * 255);
            this.setBlue((x + m) * 255);
        }
        this.setAlpha(255);
    }
    compare(color:RGB):boolean
    {
        return color && this.color === color.color;
    }
    copy(color:RGB):void
    {
        this.color = color.color;
    }
    toInt():number
    {
        return this.color;
    }
    toRGBA():Array<number>
    {
        return [this.red(), this.green(), this.blue(), this.alpha()]
    }
    alpha():number
    {
        return (this.color >> 24) & ((1<<8)-1);
    }
    blue():number
    {
        return (this.color >> 16) & ((1 << 8) - 1);
    }
    green():number
    {
        return (this.color >> 8) & ((1 << 8) - 1);
    }
    red():number
    {
        return (this.color) & ((1 << 8) - 1);
    }
    alphaNormal():number
    {
        return Math.round((((this.color >> 24) & ((1<<8)-1)) / 255)*100)/100;
    }
    setAlpha(red:number)
    {
        this.color &= (1<<24)-1;
        this.color |= red << 24;
    }
    setBlue(green:number)
    {
        this.color &= ((1 << 16) - 1) | (((1<<8)-1) << 24);
        this.color |= green << 16;
    }
    setGreen(blue:number)
    {
        this.color &= ((1<<8)-1) | (((1<<16)-1) << 16);
        this.color |= blue << 8;
    }
    setRed(alpha:number)
    {
        this.color &=  (((1<<24)-1) << 8);
        this.color |= alpha;
    }
    loadString(color:string):number
    { 
        try {
            let r:number 
            let g:number 
            let b:number 
            let a:number 
            if(color.substring(0,4).toLowerCase() !== "rgba"){
                if(color[0] !== "#")
                    throw new Error("Exception malformed color: " + color);
                r = parseInt(color.substring(1,3), 16);
                g = parseInt(color.substring(3,5), 16);
                b = parseInt(color.substring(5,7), 16);
                a = parseFloat(color.substring(7,9))*255;
            }
            else
            {
                const vals = color.split(",");
                vals[0] = vals[0].split("(")[1];
                vals[3] = vals[3].split(")")[0];
                r = parseInt(vals[0], 10);
                g = parseInt(vals[1], 10);
                b = parseInt(vals[2], 10);
                a = parseFloat(vals[3])*255;
            }
            let invalid:number = 0;
            if(!isNaN(r) && r >= 0)
            {
                if(r > 255)
                {
                    this.setRed(255);
                    invalid = 2;
                }
                else
                    this.setRed(r);
            }
            else
                invalid = +(r > 0);
            if(!isNaN(g) && g >= 0)
            {
                if(g > 255)
                {
                    this.setGreen(255);
                    invalid = 2;
                }
                else
                    this.setGreen(g);
            }
            else
                invalid = +(g > 0);
            if(!isNaN(b) && b >= 0)
            {
                if(b > 255)
                {
                    this.setBlue(255);
                    invalid = 2;
                }
                else
                    this.setBlue(b);
            }
            else
                invalid = +(b > 0);
            if(!isNaN(a) && a >= 0)
            {
                if(a > 255)
                {
                    this.setAlpha(255);
                    invalid = 2;
                }
                else
                    this.setAlpha(a);
            }
            else
                invalid = +(a > 0);
            if(color[color.length - 1] !== ")")
                invalid = 1;
            let openingPresent:boolean = false;
            for(let i = 0; !openingPresent && i < color.length; i++)
            {
                openingPresent = color[i] === "(";
            }
            if(!openingPresent)
                invalid = 1;
            return invalid;
        } catch(error:any)
        {
            console.log(error);
            return 0;
        }
        
    }
    htmlRBGA():string{
        return `rgba(${this.red()}, ${this.green()}, ${this.blue()}, ${this.alphaNormal()})`
    }
    htmlRBG():string{
        const red:string = this.red() < 16?`0${this.red().toString(16)}`:this.red().toString(16);
        const green:string = this.green() < 16?`0${this.green().toString(16)}`:this.green().toString(16);
        const blue:string = this.blue() < 16?`0${this.blue().toString(16)}`:this.blue().toString(16);
        return `#${red}${green}${blue}`
    }
};

export class Pair<T,U = T> {
    first:T;
    second:U;
    constructor(first:T, second:U)
    {
        this.first = first;
        this.second = second;
    }
};
export async function crop(image:HTMLImageElement, x:number, y:number, width:number, height:number, image_type:string = "image/png", recurs_depth:number = 0):Promise<HTMLImageElement>
{
    const canvas = document.createElement("canvas");
    if(image && image.height && image.width)
    {
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
        const res:HTMLImageElement = new Image();
        res.src = canvas.toDataURL(image_type, 1);
        return res;
    }
    else if(recurs_depth < 100)
    {
        await sleep(5);
        return await crop(image, x, y, width, height, image_type, recurs_depth + 1);
    }
    else
    {
        throw "Exception: timeout waiting to parse image data in render";
    }
}
export class ImageContainer {
    image:HTMLImageElement | HTMLCanvasElement | null;
    name:string;
    constructor(imageName:string, imagePath:string | null, callBack:((image:HTMLImageElement) => void) = (img) => "")
    {
        this.image = null;
        if(imagePath && imageName)
        fetchImage(imagePath).then(img => { 
            this.image = img;
            callBack(img);
        });
        this.name = imageName;
    }
    hflip():void
    {
        if(this.image)
        {
            const outputImage = document.createElement('canvas');

            outputImage.width = this.image.width;
            outputImage.height = this.image.height;
            
            const ctx = outputImage.getContext('2d')!;
            ctx.scale(-1, 1);

            ctx.drawImage(this.image, -outputImage.width, 0);
            this.image = outputImage;
        }

    }
};
export interface GuiElement {
    active():boolean;
    deactivate():void;
    activate():void;
    width():number;
    height():number;
    refresh():void;
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number): void;
    handleKeyBoardEvents(type:string, e:any):void;
    handleTouchEvents(type:string, e:any):void;
    isLayoutManager():boolean;
};
export class LexicoGraphicNumericPair extends Pair<number, number> {
    rollOver:number;
    constructor(rollOver:number)
    {
        super(0, 0);
        this.rollOver = rollOver;
    }
    incHigher(val:number = 1):number
    {
        this.first += val;
        return this.first;
    }
    incLower(val:number = 1):number
    {
        this.first += Math.floor((this.second + val) / this.rollOver);
        this.second = (this.second + val) % this.rollOver;
        return this.second;
    }
    hash():number
    {
        return this.first * this.rollOver + this.second;
    }
};
export class RowRecord {
    x:number;
    y:number;
    width:number;
    height:number;
    element:GuiElement;
    constructor(x:number, y:number, width:number, height:number, element:GuiElement)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.element = element;
    }
}
export class SimpleGridLayoutManager implements GuiElement {
    
    elements:GuiElement[];
    x:number;
    y:number;
    refreshRate:number;
    frameCounter:number;
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    matrixDim:number[];
    pixelDim:number[];
    elementsPositions:RowRecord[];
    focused:boolean;
    lastTouched:number;
    elementTouched:RowRecord | null;
    constructor(matrixDim:number[], pixelDim:number[], x:number = 0, y:number = 0)
    {
        this.lastTouched = 0;
        this.matrixDim = matrixDim;
        this.pixelDim = pixelDim;
        this.focused = false;
        this.x = x;
        this.y = y;
        this.refreshRate = 4;
        this.frameCounter = 0;
        this.elements = [];
        this.elementsPositions = [];
        this.canvas = document.createElement("canvas")!;
        this.canvas.width = pixelDim[0];
        this.canvas.height = pixelDim[1];
        this.ctx = this.canvas.getContext("2d")!;
        this.elementTouched = null;
    } 
    createHandlers(keyboardHandler:KeyboardHandler, touchHandler:SingleTouchListener):void
    {
        if(keyboardHandler)
        {
            keyboardHandler.registerCallBack("keydown", (e:any) => this.active(), 
            (e:any) => {e.keyboardHandler = keyboardHandler; this.elements.forEach(el => el.handleKeyBoardEvents("keydown", e))});
            keyboardHandler.registerCallBack("keyup", (e:any) => this.active(), 
            (e:any) => {e.keyboardHandler = keyboardHandler; this.elements.forEach(el => el.handleKeyBoardEvents("keyup", e))});
        }
        if(touchHandler)
        {
            touchHandler.registerCallBack("touchstart", (e:any) => this.active(), 
            (e:any) => {this.handleTouchEvents("touchstart", e)});
            touchHandler.registerCallBack("touchmove", (e:any) => this.active(), 
            (e:any) => {this.handleTouchEvents("touchmove", e)});
            touchHandler.registerCallBack("touchend", (e:any) => this.active(), 
            (e:any) => {this.handleTouchEvents("touchend", e)});
        }
    }  
    isLayoutManager():boolean {
        return true;
    } 
    handleKeyBoardEvents(type:string, e:any):void
    {
        this.elements.forEach(el => el.handleKeyBoardEvents(type, e));
        if(e.repaint)
        {
            this.refreshCanvas();
        }
    }
    handleTouchEvents(type:string, e:any):void
    {
        if(!this.elementTouched && e.touchPos[0] >= this.x && e.touchPos[0] < this.x + this.width() &&
            e.touchPos[1] >= this.y && e.touchPos[1] < this.y + this.height())
        {
            let record:RowRecord = <any> null;
            let index:number = 0;
            e.translateEvent(e,  -this.x, -this.y);
            let runningNumber:number = 0;
            this.elementsPositions.forEach(el => {
                    el.element.deactivate();
                    el.element.refresh();
                    if(e.touchPos[0] >= el.x && e.touchPos[0] < el.x + el.element.width() &&
                        e.touchPos[1] >= el.y && e.touchPos[1] < el.y + el.element.height())
                    {
                        record = el;
                        index = runningNumber;
                    }
                    runningNumber++;
            });
            e.translateEvent(e, this.x, this.y);
            if(record)
                {
                    e.preventDefault();
                    e.translateEvent(e, -record.x - this.x, -record.y - this.y);
                    if(type !== "touchmove")
                        record.element.activate();
                    record.element.handleTouchEvents(type, e);
                    e.translateEvent(e, record.x + this.x, record.y + this.y);
                    record.element.refresh();
                    this.elementTouched = record;
                    if(e.repaint)
                    {
                        this.refreshCanvas();
                    }
                    this.lastTouched = index;
            }
            
        }
        if(this.elementTouched)
        {
            e.preventDefault();
            if(type !== "touchmove")
                this.elementTouched.element.activate();
            e.translateEvent(e, -this.elementTouched.x , -this.elementTouched.y);
            this.elementTouched.element.handleTouchEvents(type, e);
            e.translateEvent(e, this.elementTouched.x , this.elementTouched.y);
            this.elementTouched.element.refresh();
            if(e.repaint)
            {
                this.refreshCanvas();
            }
        }
        if(type === "touchend")
            this.elementTouched = null;
    }
    refresh():void {
        this.refreshMetaData();
        this.refreshCanvas();
    }
    deactivate():void
    {
        this.focused = false;
        this.elements.forEach(el => {
            el.deactivate();
        });
    }
    activate():void
    {
        this.focused = true;
        this.elements.forEach(el => {
            el.activate();
        });
    }
    isCellFree(x:number, y:number):boolean
    {
        const pixelX:number = x * this.pixelDim[0] / this.matrixDim[0];
        const pixelY:number = y * this.pixelDim[1] / this.matrixDim[1];
        let free:boolean = true;
        if(pixelX < this.pixelDim[0] && pixelY < this.pixelDim[1])
        for(let i = 0; free && i < this.elementsPositions.length; i++)
        {
            const elPos:RowRecord = this.elementsPositions[i];
            if(elPos.x <= pixelX && elPos.x + elPos.width > pixelX &&
                elPos.y <= pixelY && elPos.y + elPos.height > pixelY)
                free = false;
        }
        else 
            free = false;
        return free;
    }
    refreshMetaData(xPos:number = 0, yPos:number = 0, offsetX:number = 0, offsetY:number = 0):void
    {
        this.elementsPositions.splice(0, this.elementsPositions.length);        
        const width:number = this.columnWidth();
        const height:number = this.rowHeight();
        let counter:LexicoGraphicNumericPair = new LexicoGraphicNumericPair(this.matrixDim[0]);
        let matX:number = 0;
        let matY:number = 0;
        for(let i = 0; i < this.elements.length; i++)
        {
            const element:GuiElement = this.elements[i];
            const elementWidth:number = Math.ceil(element.width() / this.columnWidth());
            let clearSpace:boolean = true;
            do {
                let j = counter.second;
                clearSpace = true;
                for(;clearSpace && j < counter.second + elementWidth; j++)
                {
                    clearSpace = this.isCellFree(j, counter.first);
                }
                if(!clearSpace && j < elementWidth)
                {
                    counter.incLower(j - counter.second);
                }
                else if(!clearSpace && j >= elementWidth)
                {
                    counter.incHigher();
                    counter.second = 0;
                }
            } while(!clearSpace && counter.first < this.matrixDim[1]);
            const x:number = counter.second * this.columnWidth();
            const y:number = counter.first * this.rowHeight();
            counter.second += elementWidth;
            if(element.isLayoutManager())
            {
                (<SimpleGridLayoutManager> element).x = x + this.x;
                (<SimpleGridLayoutManager> element).y = y + this.y;
            }
            const record:RowRecord = new RowRecord(x + xPos + offsetX, y + yPos + offsetY, element.width(), element.height(), element);
            this.elementsPositions.push(record);
        }
    }
    refreshCanvas(ctx:CanvasRenderingContext2D = this.ctx, x:number = 0, y:number = 0):void
    {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.elementsPositions.forEach(el => 
            el.element.draw(ctx, el.x, el.y, x, y));
    }
    active():boolean
    {
        return this.focused;
    }
    width(): number {
        return this.pixelDim[0];
    }
    setWidth(val:number): void {
        this.pixelDim[0] = val;
        this.canvas.width = val;
    }
    height(): number {
        return this.pixelDim[1];
    }
    setHeight(val:number): void {
        this.pixelDim[1] = val;
        this.canvas.height = val;
    }
    rowHeight():number
    {
        return this.pixelDim[1] / this.matrixDim[1];
    }
    columnWidth():number
    {
        return this.pixelDim[0] / this.matrixDim[0];
    }
    usedRows():number {
        for(let i = 0; i < this.elements.length; i++)
        {
            
        }
        return this.elements.length - 1;
    }
    hasSpace(element:GuiElement):boolean
    {
        const elWidth:number = Math.floor((element.width() / this.columnWidth()) * this.matrixDim[0]);
        const elHeight:number = Math.floor((element.height() / this.rowHeight()) * this.matrixDim[1]);
        if(this.elements.length)
        {
            //todo
        }
        //todo
        return false;
    }
    addElement(element:GuiElement, position:number = -1):boolean //error state
    {
        let inserted:boolean = false;
        if(position === -1)
        {
            this.elements.push(element);
        }
        else
        {
            this.elements.splice(position, 0, element);
        }
        this.refreshMetaData();
        this.refreshCanvas();
        return inserted;
    }
    removeElement(element:GuiElement): void
    {
        this.elements.splice(this.elements.indexOf(element), 1);
        this.refreshMetaData();
        this.refreshCanvas();
    }
    elementPosition(element:GuiElement):number[]
    {
        const elPos:RowRecord | undefined = this.elementsPositions.find((el:RowRecord) => el.element === element);
        if(elPos === undefined)
            return [-1, -1];
        return [elPos.x, elPos.y];
    }
    draw(ctx:CanvasRenderingContext2D, xPos:number = this.x, yPos:number = this.y, offsetX:number = 0, offsetY:number = 0)
    {
        this.refreshCanvas();
        ctx.drawImage(this.canvas, xPos + offsetX, yPos + offsetY);
    }
};
//tbd
export class ScrollingGridLayoutManager extends SimpleGridLayoutManager {
    offset:number[];
    scrolledCanvas:HTMLCanvasElement;

    constructor(matrixDim:number[], pixelDim:number[], x:number = 0, y:number = 0)
    {
        super(matrixDim, pixelDim, x, y);
        this.scrolledCanvas = document.createElement("canvas");
        this.offset = [0, 0];
    }
    handleScrollEvent(event:any)
    {

    }
    refreshCanvas():void {
        super.refreshCanvas();
    }

};
export class GuiListItem extends SimpleGridLayoutManager {
    textBox:GuiTextBox;
    checkBox:GuiCheckBox;
    slider:GuiSlider | null;
    sliderX:number | null;
    callBackType:string;
    callBack:((e:any) => void) | null;
    constructor(text:string, state:boolean, pixelDim:number[], fontSize:number = 16, callBack:((e:any) => void) | null = () => {}, genericCallBack:((e:any) => void) | null = null, slideMoved:((event:SlideEvent) => void) | null = null, flags:number = GuiTextBox.bottom, genericTouchType:string = "touchend")
    {
        super([20, 1], pixelDim);
        this.callBackType = genericTouchType;
        this.callBack = genericCallBack;
        this.checkBox = new GuiCheckBox(callBack, pixelDim[1], pixelDim[1], state);
        const width:number = (pixelDim[0] - fontSize * 2 - 10) >> (slideMoved ? 1: 0);
        this.textBox = new GuiTextBox(false, width, null, fontSize, pixelDim[1], flags);
        this.textBox.setText(text);
        this.addElement(this.checkBox);
        this.addElement(this.textBox);
        if(slideMoved)
        {
            this.slider = new GuiSlider(1, [width, pixelDim[1]], slideMoved);
            this.sliderX = width + pixelDim[1];
            this.addElement(this.slider);
        }
        else
        {
            this.slider = null;
            this.sliderX = -1;
        }
    }
    handleTouchEvents(type: string, e: any): void {
        super.handleTouchEvents(type, e);
        if(this.active() && type === this.callBackType)
        {
            e.item = this;
            if(this.callBack)
                this.callBack(e);
        }
    }
    state():boolean {
        return this.checkBox.checked;
    }
};
export class SlideEvent {
    value:number;
    element:GuiSlider;
    constructor(value:number, element:GuiSlider)
    {
        this.value = value;
        this.element = element;
    }
}
export class GuiCheckList implements GuiElement {
    limit:number;
    list:GuiListItem[];
    dragItem:GuiListItem | null;
    dragItemLocation:number[];
    dragItemInitialIndex:number;
    layoutManager:SimpleGridLayoutManager;
    fontSize:number;
    focused:boolean;
    uniqueSelection:boolean;
    swapElementsInParallelArray:((x1:number, x2:number) => void) | null;
    slideMoved:((event:SlideEvent) => void) | null;
    constructor(matrixDim:number[], pixelDim:number[], fontSize:number, uniqueSelection:boolean, swap:((x1:number, x2:number) => void) | null = null, slideMoved:((event:SlideEvent) => void) | null = null)
    {
        this.focused = true;
        this.uniqueSelection = uniqueSelection;
        this.fontSize = fontSize;
        this.layoutManager = new SimpleGridLayoutManager ([1,matrixDim[1]], pixelDim);
        this.list = [];
        this.limit = 0;
        this.dragItem = null;
        this.dragItemLocation = [-1, -1];
        this.dragItemInitialIndex = -1;
        this.slideMoved = slideMoved;
        this.swapElementsInParallelArray = swap;
    }
    push(text:string, state:boolean = true, checkBoxCallback:(event:any) => void, onClickGeneral:(event:any) => void): void
    {
        const newElement:GuiListItem = new GuiListItem(text, state, [this.width(),
            this.height() / this.layoutManager.matrixDim[1] - 5], this.fontSize, checkBoxCallback, onClickGeneral, this.slideMoved);
        this.list.push(newElement);
    }
    selected():number
    {
        return this.layoutManager.lastTouched;
    }
    selectedItem():GuiListItem | null
    {
        if(this.selected() !== -1)
            return this.list[this.selected()];
        else
            return null;
    }
    findBasedOnCheckbox(checkBox:GuiCheckBox):number
    {
        let index:number = 0;
        for(; index < this.list.length; index++)
        {
            if(this.list[index].checkBox === checkBox)
                break;
        }
        return index;
    }
    get(index:number):GuiListItem | null
    {
        if(this.list[index])
            return this.list[index];
        else
            return null;
    }
    isChecked(index:number):boolean
    {
        return this.list[index] ? this.list[index].checkBox.checked : false;
    }
    delete(index:number):void 
    {
        if(this.list[index])
        {
            this.list.splice(index, 1);
            this.refresh();
        }
    }
    active():boolean
    {
        return this.focused;
    }
    deactivate():void 
    {
        this.focused = false;
    }
    activate():void
    {
        this.focused = true;
    }
    width():number
    {
        return this.layoutManager.width();
    }
    height():number
    {
        return this.layoutManager.height();
    }
    refresh():void
    {
        this.layoutManager.elements = this.list;
        this.layoutManager.refresh();
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number): void
    {
        //this.layoutManager.draw(ctx, x, y, offsetX, offsetY);
        const itemsPositions:RowRecord[] = this.layoutManager.elementsPositions;
        let offsetI:number = 0;
        for(let i = 0; i < itemsPositions.length; i++)
        {
            if(this.dragItem && this.dragItemLocation[1] !== -1 && i === Math.floor((this.dragItemLocation[1] / this.height()) * this.layoutManager.matrixDim[1]))
            {
                offsetI++;
            }
            this.list[i].draw(ctx, x, y + offsetI * (this.height() / this.layoutManager.matrixDim[1]), offsetX, offsetY);
            offsetI++;
        }
        if(this.dragItem)
            this.dragItem.draw(ctx, x + this.dragItemLocation[0] - this.dragItem.width() / 2, y + this.dragItemLocation[1] - this.dragItem.height() / 2, offsetX, offsetY);
    }
    handleKeyBoardEvents(type:string, e:any):void
    {
        this.layoutManager.handleKeyBoardEvents(type, e);
    }
    handleTouchEvents(type:string, e:any):void
    {
        let checkedIndex:number = -1;
        if(this.uniqueSelection)
        {
            for(let i = 0; i < this.list.length; i++) {
                if(this.list[i].checkBox.checked)
                {
                    checkedIndex = i;
                }
            };
            this.layoutManager.handleTouchEvents(type, e);
            for(let i = 0; i < this.list.length; i++)
            {
                if(this.list[i].checkBox.checked && i !== checkedIndex)
                {
                    this.list[checkedIndex].checkBox.checked = false;
                    this.list[checkedIndex].checkBox.refresh();
                    break;
                }     
            }
        }
        else {
            this.layoutManager.handleTouchEvents(type, e);
        }
        const clicked:number = Math.floor((e.touchPos[1] / this.height()) * this.layoutManager.matrixDim[1]);
        this.layoutManager.lastTouched = clicked > this.list.length ? this.list.length - 1 : clicked;
        switch(type)
        {
            case("touchend"):
            if(this.dragItem)
            {
                this.list.splice(clicked, 0, this.dragItem);
                if(this.swapElementsInParallelArray && this.dragItemInitialIndex !== -1)
                {
                    if(clicked > this.list.length)
                        this.swapElementsInParallelArray(this.dragItemInitialIndex, this.list.length - 1);
                    else
                    this.swapElementsInParallelArray(this.dragItemInitialIndex, clicked);
                }
                this.dragItem = null;
                this.dragItemInitialIndex = -1;
                this.dragItemLocation[0] = -1;
                this.dragItemLocation[1] = -1;
            }
            if(this.selectedItem() && this.selectedItem()!.callBack)
                this.selectedItem()!.callBack!(e);
            break;
            case("touchmove"):
            const movesNeeded:number = isTouchSupported()?7:2;
            if(this.selectedItem() && e.touchPos[0] < this.selectedItem()!.sliderX)
            {
                if(e.moveCount === movesNeeded && this.selectedItem() && this.list.length > 1)
                {
                    this.dragItem = this.list.splice(this.selected(), 1)[0];
                    this.dragItemInitialIndex = this.selected();
                    this.dragItemLocation[0] = e.touchPos[0];
                    this.dragItemLocation[1] = e.touchPos[1];
                }
                else if(e.moveCount > movesNeeded)
                {
                    this.dragItemLocation[0] += e.deltaX;
                    this.dragItemLocation[1] += e.deltaY;
                }
            }
            else if(e.moveCount > movesNeeded)
            {
                this.dragItemLocation[0] += e.deltaX;
                this.dragItemLocation[1] += e.deltaY;
            }
            break;
        }
    }
    isLayoutManager():boolean
    {
        return false;
    }
};
export class GuiSlider implements GuiElement {
    state:number;//between 0.0, and 1.0
    focused:boolean;
    dim:number[];
    canvas:HTMLCanvasElement;
    callBack:((event:SlideEvent) => void) | null;
    constructor(state:number, dim:number[], movedCallBack:((event:SlideEvent) => void) | null){
        this.state = state;
        this.callBack = movedCallBack;
        this.focused = false;
        this.dim = [dim[0], dim[1]];
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width();
        this.canvas.height = this.height();
        this.refresh();
    }
    setState(value:number):void
    {
        if(value < 1  && value >= 0)
            this.state = value;
        else if(value >= 1)
            this.state = value;
        this.refresh();
    }
    active():boolean
    {
        return this.focused;
    }
    deactivate():void
    {
        this.focused = false;
    }
    activate():void
    {
        this.focused = true;
    }
    width():number
    {
        return this.dim[0];
    }
    height():number
    {
        return this.dim[1];
    }
    getBounds():number[]
    {
        return [this.width() / 10, this.height()/ 10, this.width() - this.width() / 5, this.height() - this.height() / 5];
    }
    refresh():void
    {
        const ctx:CanvasRenderingContext2D = this.canvas.getContext("2d")!;
        ctx.clearRect(0, 0, this.width(), this.height());
        ctx.fillStyle = "#FFFFFF";
        const bounds:number[] = this.getBounds();
        const center:number[] = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
        const displayLineX:number = this.state * bounds[2] + bounds[0];
        ctx.fillRect(bounds[0] - 1, center[1] - 1, bounds[2]+2, 4);
        ctx.fillRect(displayLineX - 1, bounds[1]-1, 5 + 1, bounds[3] + 2);
        ctx.fillStyle = "#000000";
        ctx.fillRect(bounds[0], center[1], bounds[2], 2);
        ctx.fillRect(displayLineX, bounds[1], 4, bounds[3]);
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number):void
    {
        ctx.drawImage(this.canvas, x + offsetX, y + offsetY);
    }
    handleKeyBoardEvents(type:string, e:any):void
    {

    }
    handleTouchEvents(type:string, e:any):void
    {
        const bounds:number[] = [this.width() / 10, this.height()/ 10, this.width() - this.width() / 5, this.height() - this.height() / 5];
        switch(type)
        {
            case("touchstart"):
            this.state = (e.touchPos[0] - bounds[0]) / bounds[2];
            break;
            case("touchmove"):
            this.state = (e.touchPos[0] - bounds[0]) / bounds[2];
            break;
        }
        if(this.state > 1)
            this.state = 1;
        else if(this.state < 0)
            this.state = 0;
        if(this.callBack)
            this.callBack({value:this.state, element:this});
        this.refresh();
    }
    isLayoutManager():boolean
    {
        return false;
    }
};
export class GuiSpacer implements GuiElement {
    dim:number[];
    constructor(dim:number[]){
        this.dim = [dim[0], dim[1]];
        this.refresh();
    }
    active():boolean
    {
        return false;
    }
    deactivate():void
    {}
    activate():void
    {}
    width():number
    {
        return this.dim[0];
    }
    height():number
    {
        return this.dim[1];
    }
    refresh():void
    {}
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number):void
    {}
    handleKeyBoardEvents(type:string, e:any):void
    {}
    handleTouchEvents(type:string, e:any):void
    {}
    isLayoutManager():boolean
    {
        return false;
    }
};
export class GuiColoredSpacer implements GuiElement {
    dim:number[];
    color:RGB;
    constructor(dim:number[], color:RGB){
        this.dim = [dim[0], dim[1]];
        this.color = new RGB(0,0,0);
        this.color.copy(color);
        this.refresh();
    }
    active():boolean
    {
        return false;
    }
    deactivate():void
    {}
    activate():void
    {}
    width():number
    {
        return this.dim[0];
    }
    height():number
    {
        return this.dim[1];
    }
    refresh():void
    {}
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number):void
    {
        const originalFillStyle:string | CanvasPattern | CanvasGradient = ctx.fillStyle;
        const originalStrokeStyle:string | CanvasPattern | CanvasGradient = ctx.strokeStyle;
        const colorString:string = this.color.htmlRBGA();
        if(colorString !== originalFillStyle)
        {
            ctx.fillStyle = colorString;
        }
        if("#000000" !== originalStrokeStyle)
        {
            ctx.strokeStyle = "#000000";
        }
        ctx.fillRect(x + offsetX, y + offsetY, this.dim[0], this.dim[1]);
        ctx.strokeRect(x + offsetX, y + offsetY, this.dim[0], this.dim[1]);
        if(colorString !== originalFillStyle)
        {
            ctx.fillStyle = originalFillStyle;
        }
        if("#000000" !== originalStrokeStyle)
        {
            ctx.strokeStyle = originalStrokeStyle;
        }
    }
    handleKeyBoardEvents(type:string, e:any):void
    {}
    handleTouchEvents(type:string, e:any):void
    {}
    isLayoutManager():boolean
    {
        return false;
    }
};
export class GuiButton implements GuiElement {

    text:string;
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    dimensions:number[];//[width, height]
    fontSize:number;
    pressedColor:RGB;
    unPressedColor:RGB;
    pressed:boolean;
    focused:boolean;
    font:FontFace;
    fontName:string
    callback:(() => void) | null;
    constructor(callBack:() => void | null, text:string, width:number = 200, height:number = 50, fontSize:number = 12, pressedColor:RGB = new RGB(150, 150, 200, 255), unPressedColor:RGB = new RGB(255, 255, 255, 195), fontName:string = "button_font")
    {
        this.text = text;
        this.fontSize = fontSize;
        this.dimensions = [width, height];
        this.canvas = document.createElement("canvas")!;
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d")!;
        this.pressedColor = pressedColor;
        this.unPressedColor = unPressedColor;
        this.pressed = false;
        this.focused = true;
        this.callback = callBack;
        this.fontName = fontName;
        //if(document.fonts.check(`16px ${this.fontName}`, "a"))
        {
            this.font = new FontFace(`${this.fontName}`, 'url(/web/fonts/Minecraft.ttf)');
            this.font.load().then((loaded_face) =>{
                document.fonts.add(loaded_face);
                this.drawInternal();
            }, (error:Error) => {
                this.font = new FontFace(`${this.fontName}`, 'url(/fonts/Minecraft.ttf)');
                this.font.load().then((loaded_face:any) => {
                        document.fonts.add(loaded_face);
                        this.drawInternal();
                    }, (error:Error) => {
                        console.log(error.message);
                        this.drawInternal();
                    });
            });
        }
    }
    handleKeyBoardEvents(type:string, e:any):void
    {
        if(this.active()){
            if(e.code === "Enter"){
                switch(type)
                {
                    case("keydown"):
                        this.pressed = true;
                        this.drawInternal();
                    break;
                    case("keyup"):
                    if(this.callback)
                        this.callback();
                        this.pressed = false;
                        this.drawInternal();
                        this.deactivate();
                    break;
                }
            }
        }
    }
    handleTouchEvents(type:string, e:any):void
    {
        if(this.active())
            switch(type)
            {
                case("touchstart"):
                    this.pressed = true;
                    this.drawInternal();
                break;
                case("touchend"):
                if(this.callback)
                    this.callback();
                    this.pressed = false;
                    this.drawInternal();
                break;
            }
            
    }
    isLayoutManager():boolean {
        return false;
    } 
    active():boolean
    {
        return this.focused;
    }
    deactivate():void
    {
        this.focused = false;
    }
    activate():void
    {
        this.focused = true;
    }
    width(): number {
        return this.dimensions[0];
    }
    height(): number {
        return this.dimensions[1];
    }
    setCtxState(ctx:CanvasRenderingContext2D):void
    {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        if(this.pressed)
            ctx.fillStyle = this.pressedColor.htmlRBGA();
        else
            ctx.fillStyle = this.unPressedColor.htmlRBGA();
        ctx.font = this.fontSize + `px ${this.fontName}`;
    }
    refresh(): void {
        this.drawInternal();
    }
    drawInternal(ctx:CanvasRenderingContext2D = this.ctx):void
    {
        const fs = ctx.fillStyle;
        this.setCtxState(ctx);
        ctx.fillRect(0, 0, this.width(), this.height());
        ctx.strokeRect(0, 0, this.width(), this.height());
        ctx.fillStyle = "#000000";
        const textWidth:number = ctx.measureText(this.text).width;
        const textHeight:number = this.fontSize;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 4;
        if(textWidth < this.width() - 10)
        {
            ctx.strokeText(this.text, this.width() / 2 - textWidth / 2, this.height() / 2 + textHeight / 2, this.width());
            ctx.fillText(this.text, this.width() / 2 - textWidth / 2, this.height() / 2 + textHeight / 2, this.width());
        }
        else
        {
            ctx.strokeText(this.text, 10, this.height() / 2 + textHeight / 2, this.width() - 20);
            ctx.fillText(this.text, 10, this.height() / 2 + textHeight / 2, this.width() - 20);
        }
        ctx.fillStyle = fs;
    } 
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number = 0, offsetY:number = 0):void
    {
        ctx.drawImage(this.canvas, x + offsetX, y + offsetY);
        if(!this.active())
        {
            ctx.fillStyle = new RGB(0, 0, 0, 125).htmlRBGA();
            ctx.fillRect(x, y, this.width(), this.height());
        }
    }
};

interface FilesHaver{
    files:FileList;
};
export class GuiButtonFileOpener extends GuiButton {
    constructor(callback:(binary:Int32Array) => void, text:string, width:number, height:number, fontSize = 12, pressedColor:RGB = new RGB(150, 150, 200, 255), unPressedColor:RGB = new RGB(255, 255, 255, 195), fontName:string = "Helvetica")
    {
        super(() => {
            const input:HTMLInputElement = document.createElement('input');
            input.type="file";
            input.addEventListener('change', (event) => {
                const fileList:FileList = (<FilesHaver> <Object> event.target).files;
                const reader = new FileReader();
                fileList[0].arrayBuffer().then((buffer) =>
                  {
                      const binary:Int32Array = new Int32Array(buffer);
                      callback(binary);
                  });
              });
            input.click();
        }, text, width, height, fontSize, pressedColor, unPressedColor, fontName);
    }
}
export class GuiCheckBox implements GuiElement {

    checked:boolean;
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    dimensions:number[];//[width, height]
    fontSize:number;
    pressedColor:RGB;
    unPressedColor:RGB;
    pressed:boolean;
    focused:boolean;
    callback:((event:any) => void) | null;
    constructor(callBack:((event:any) => void) | null, width:number = 50, height:number = 50, checked:boolean = false, unPressedColor:RGB = new RGB(255, 255, 255, 0), pressedColor:RGB = new RGB(150, 150, 200, 255), fontSize:number = height - 10)
    {
        this.checked = checked;
        this.fontSize = fontSize;
        this.dimensions = [width, height];
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d")!;
        this.pressedColor = pressedColor;
        this.unPressedColor = unPressedColor;
        this.pressed = false;
        this.focused = true;
        this.callback = callBack;
        this.drawInternal();
    }
    handleKeyBoardEvents(type:string, e:any):void
    {
        if(this.active()){
            if(e.code === "Enter"){
                switch(type)
                {
                    case("keydown"):
                        this.pressed = true;
                        this.drawInternal();
                    break;
                    case("keyup"):
                        e.checkBox = this;
                        if(this.callback)
                            this.callback(e);
                        this.pressed = false;
                        this.drawInternal();
                        this.deactivate();
                    break;
                }
            }
        }
    }
    isLayoutManager():boolean {
        return false;
    } 
    handleTouchEvents(type:string, e:any):void
    {
        if(this.active())
            switch(type)
            {
                case("touchstart"):
                    this.pressed = true;
                    this.drawInternal();
                break;
                case("touchend"):
                    this.checked = !this.checked;
                    this.pressed = false;
                    e.checkBox = this;
                    if(this.callback)
                        this.callback(e);
                    this.drawInternal();
                break;
            }
            
    }
    active():boolean
    {
        return this.focused;
    }
    deactivate():void
    {
        this.focused = false;
    }
    activate():void
    {
        this.focused = true;
    }
    width(): number {
        return this.dimensions[0];
    }
    height(): number {
        return this.dimensions[1];
    }
    setCtxState(ctx:CanvasRenderingContext2D):void
    {
        if(this.pressed)
            ctx.fillStyle = this.pressedColor.htmlRBGA();
        else
            ctx.fillStyle = this.unPressedColor.htmlRBGA();
        ctx.font = this.fontSize + 'px Calibri';
    }
    refresh(): void {
        this.drawInternal();
    }
    drawInternal(ctx:CanvasRenderingContext2D = this.ctx):void
    {
        const fs = ctx.fillStyle;
        this.setCtxState(ctx);
        ctx.clearRect(0, 0, this.width(), this.height());
        ctx.fillRect(0, 0, this.width(), this.height());
        ctx.fillStyle = "#000000";
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
        ctx.strokeStyle = "#FFFFFF";
        ctx.strokeRect(3, 3, this.canvas.width - 6, this.canvas.height - 6);
        ctx.fillText(this.checked?"\u2713":"", this.width()/2 - this.ctx.measureText("\u2713").width/2, 0 + this.fontSize, this.width());
        
        ctx.strokeText(this.checked?"\u2713":"", this.width()/2 - this.ctx.measureText("\u2713").width/2, 0 + this.fontSize, this.width());
        
        ctx.fillStyle = fs;
    } 
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number = 0, offsetY:number = 0):void
    {
        ctx.drawImage(this.canvas, x + offsetX, y + offsetY);
    }
};
export class TextRow { 
    text:string;
    x:number;
    y:number;
    width:number;
    constructor(text:string, x:number, y:number, width:number)
    {
        this.text = text;
        this.x = x;
        this.y = y;
        this.width = width;
    }
};
export class Optional<T> {
    data:T | null;
    constructor() {
        this.data = null;
    }
    get():T | null
    {
        return this.data;
    } 
    set(data:T):void
    {
        this.data = data;
    }
    clear():void
    {
        this.data = null;
    }
};
export interface TextBoxEvent {
    event:any;
    textbox:GuiTextBox;
    oldCursor:number;
    oldText:string;
};
export class GuiTextBox implements GuiElement {
    text:string;
    asNumber:Optional<number>;
    rows:TextRow[];
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    cursor:number;
    scaledCursorPos:number[];
    cursorPos:number[];
    scroll:number[];
    focused:boolean;
    selectedColor:RGB;
    unSelectedColor:RGB;
    dimensions:number[];//[width, height]
    fontSize:number;
    static center:number = 0;
    static bottom:number = 1;
    static top:number = 2;
    static verticalAlignmentFlagsMask:number = 0b0011;
    static left:number = 0;
    static hcenter:number = (1 << 2);
    static right:number = (2 << 2);
    static farleft:number = (3 << 2);
    static horizontalAlignmentFlagsMask:number = 0b1100;
    static default:number =  GuiTextBox.center | GuiTextBox.left;

    static textLookup = {};
    static numbers = {};
    static specialChars = {};
    static textBoxRunningNumber:number = 0;
    textBoxId:number;
    flags:number;
    submissionButton:GuiButton | null;
    promptText:string;
    font:FontFace;
    fontName:string;
    handleKeyEvents:boolean;
    outlineTextBox:boolean;
    validationCallback:((tb:TextBoxEvent) => boolean) | null;
    constructor(keyListener:boolean, width:number, submit:GuiButton | null = null, fontSize:number = 16, height:number = 2*fontSize, flags:number = GuiTextBox.default,
        validationCallback:((event:TextBoxEvent) => boolean) | null = null, selectedColor:RGB = new RGB(80, 80, 220), unSelectedColor:RGB = new RGB(100, 100, 100), outline:boolean = true, fontName = "textBox_default", customFontFace:FontFace | null = null)
    {
        this.handleKeyEvents = keyListener;
        this.outlineTextBox = outline;
        this.validationCallback = validationCallback;
        GuiTextBox.textBoxRunningNumber++;
        this.textBoxId = GuiTextBox.textBoxRunningNumber;
        this.cursor = 0;
        this.flags = flags;
        this.focused = false;
        this.promptText = "";
        this.submissionButton = submit;
        this.selectedColor = selectedColor;
        this.unSelectedColor = unSelectedColor;
        this.asNumber = new Optional<number>();
        this.text = "";
        this.scroll = [0, 0];
        this.scaledCursorPos = [0, 0];
        this.cursorPos = [0, 0];
        this.rows = [];
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d")!;
        this.dimensions = [width, height];
        this.fontSize = fontSize;
        this.fontName = fontName;
        {
            if(customFontFace){
                this.font = customFontFace;
                this.font.family
            }
            else
                this.font = new FontFace(fontName, 'url(/web/fonts/Minecraft.ttf)');
            this.font.load().then((loaded_face) =>{
                document.fonts.add(loaded_face);
                this.drawInternalAndClear();
            }, (error:Error) => {
                this.font = new FontFace(fontName, 'url(/fonts/Minecraft.ttf)');
                this.font.load().then((loaded_face:any) => {
                        document.fonts.add(loaded_face);
                        this.refresh();
                    }, (error:Error) => {
                        console.log(error.message);
                        this.refresh();
                    });
            });
        }
    }
    //take scaled pos calc delta from cursor pos
    //
    isLayoutManager():boolean {
        return false;
    } 
    hflag():number {
        return this.flags & GuiTextBox.horizontalAlignmentFlagsMask;
    }
    hcenter():boolean {
        return this.hflag() === GuiTextBox.hcenter;
    }
    left():boolean {
        return this.hflag() === GuiTextBox.left;
    }
    farleft():boolean {
        return this.hflag() === GuiTextBox.farleft;
    }
    right():boolean {
        return this.hflag() === GuiTextBox.right;
    }
    center():boolean
    {
        return (this.flags & GuiTextBox.verticalAlignmentFlagsMask) === GuiTextBox.center;
    }
    top():boolean
    {
        return (this.flags & GuiTextBox.verticalAlignmentFlagsMask) === GuiTextBox.top;
    }
    bottom():boolean
    {
        return (this.flags & GuiTextBox.verticalAlignmentFlagsMask) === GuiTextBox.bottom;
    }
    handleKeyBoardEvents(type:string, e:any):void
    {
        let preventDefault:boolean = false;
        if(this.active() && this.handleKeyEvents) {
            preventDefault = true;
            const oldText:string = this.text;
            const oldCursor:number = this.cursor;
            switch(type)
            {
                case("keydown"):
                switch(e.code)
                {
                    case("NumpadEnter"):
                    case("Enter"):
                    this.deactivate();
                    if(this.submissionButton)
                    {
                        this.submissionButton.activate();
                        this.submissionButton.handleKeyBoardEvents(type, e);
                    }
                    break;
                    case("Space"):
                        this.text = this.text.substring(0, this.cursor) + ' ' + this.text.substring(this.cursor, this.text.length);
                        this.cursor++;
                    break;
                    case("Backspace"):
                        this.text = this.text.substring(0, this.cursor-1) + this.text.substring(this.cursor, this.text.length);
                        this.cursor -= +(this.cursor>0);
                    break;
                    case("Delete"):
                        this.text = this.text.substring(0, this.cursor) + this.text.substring(this.cursor+1, this.text.length);
                    break;
                    case("ArrowLeft"):
                        this.cursor -= +(this.cursor > 0);
                    break;
                    case("ArrowRight"):
                        this.cursor += +(this.cursor < this.text.length);
                    break;
                    case("ArrowUp"):
                        this.cursor = 0;
                    break;
                    case("ArrowDown"):
                        this.cursor = (this.text.length);
                    break;
                    case("Period"):
                    this.text = this.text.substring(0, this.cursor) + "." + this.text.substring(this.cursor, this.text.length);
                    this.cursor++;
                    break;
                    case("Comma"):
                    this.text = this.text.substring(0, this.cursor) + "," + this.text.substring(this.cursor, this.text.length);
                    this.cursor++;
                    break;
                    default:
                    {
                        let letter:string = e.code.substring(e.code.length - 1);
                        if(!e.keysHeld["ShiftRight"] && !e.keysHeld["ShiftLeft"])
                            letter = letter.toLowerCase();
                        if((<any> GuiTextBox.textLookup)[e.code] || (<any> GuiTextBox.numbers)[e.code])
                        {
                            this.text = this.text.substring(0, this.cursor) + letter + this.text.substring(this.cursor, this.text.length);
                            this.cursor++;
                        }
                        else if((<any> GuiTextBox.specialChars)[e.code])
                        {
                            //todo
                        }
                        else if(e.code.substring(0,"Numpad".length) === "Numpad")
                        {
                            this.text = this.text.substring(0, this.cursor) + letter + this.text.substring(this.cursor, this.text.length);
                            this.cursor++;
                        }

                    }
                }
                this.calcNumber();
                if(this.validationCallback)
                {
                    if(!this.validationCallback({textbox:this, event:e, oldCursor:oldCursor, oldText:oldText}))
                    {
                        this.text = oldText;
                        this.cursor = oldCursor;
                    }
                    else {
                        this.drawInternalAndClear();
                    }
                }
                else
                {
                    this.drawInternalAndClear();
                }
                    
            }
        }
        if(preventDefault)
            e.preventDefault();
    }
    setText(text:string):void
    {
        this.text = text;
        this.cursor = text.length;
        this.calcNumber();
        this.drawInternalAndClear();
    }
    calcNumber():void
    {
        if(!isNaN(Number(this.text)))
        {
            this.asNumber.set(Number(this.text))
        }
        else
            this.asNumber.clear();
    }
    handleTouchEvents(type:string, e:any):void
    {
        if(this.active()){
            switch(type)
            {
                case("touchend"):
                if(isTouchSupported() && this.handleKeyEvents)
                {
                    const value = prompt(this.promptText, this.text);
                    if(value)
                    {
                        this.setText(value);
                        this.calcNumber();
                        this.deactivate();
                        if(this.submissionButton)
                        {
                            this.submissionButton!.activate();
                            this.submissionButton!.callback!();
                        }
                    }
                }
                this.drawInternalAndClear();
                break;
            }
        }
    }
    static initGlobalText():void
    {
        for(let i = 65; i < 65+26; i++)
            (<any> GuiTextBox.textLookup)["Key" + String.fromCharCode(i)] = true;
    };
    static initGlobalNumbers():void
    {
        for(let i = 48; i < 48+10; i++){
            (<any> GuiTextBox.numbers)["Digit" + String.fromCharCode(i)] = true;
        }
    };
    static initGlobalSpecialChars():void
    {
        //specialChars
    }
    active():boolean
    {
        return this.focused;
    }
    deactivate():void
    {
        this.focused = false;
        this.refresh();
    }
    activate():void
    {
        this.focused = true;
        this.refresh();
    }
    textWidth():number
    {
        return this.ctx.measureText(this.text).width;
    }
    setCtxState():void
    {
        this.ctx.strokeStyle = "#000000";
        this.ctx.font = this.fontSize + `px ${this.fontName}`;
    }
    width(): number {
        return this.dimensions[0];
    }
    height(): number {
        return this.dimensions[1];
    }
    refreshMetaData(text:string = this.text, x:number = 0, y:number = this.fontSize, cursorOffset:number = 0): Pair<number, number[]>
    {
        if(text.search("\n") !== -1)
        {
            const rows:string[] = text.split("\n");
           let indeces:Pair<number, number[]> = new Pair(cursorOffset, [x, y]);
            rows.forEach(row => {
                indeces = this.refreshMetaData(row, indeces.second[0], indeces.second[1] + this.fontSize, indeces.first);
            });
            return indeces;
        }
        const textWidth:number = this.ctx.measureText(text).width;
        const canvasWidth:number = this.canvas.width;
        const rows:number = Math.ceil(textWidth / (canvasWidth - (20+x)));
        const charsPerRow:number = Math.floor(text.length / rows);
        const cursor:number = this.cursor - cursorOffset;
        let charIndex:number = 0;
        let i = 0;
        for(; i < rows - 1; i++)
        {
            const yPos:number = i * this.fontSize + y;
            if(cursor >= charIndex && cursor <= charIndex + charsPerRow)
            {
                this.cursorPos[1] = yPos;
                const substrWidth:number = this.ctx.measureText(text.substring(charIndex, cursor)).width;
                this.cursorPos[0] = substrWidth + x;
            }
            const substr:string = text.substring(charIndex, charIndex + charsPerRow);
            this.rows.push(new TextRow(substr, x, yPos, this.width() - x));
            charIndex += charsPerRow;
        }
        const yPos = i * this.fontSize + y;
        const substring:string = text.substring(charIndex, text.length);
        const substrWidth:number = this.ctx.measureText(substring).width;
        

        if(substrWidth > this.width() - x)
            this.refreshMetaData(substring, x, i * this.fontSize + y, cursorOffset + charIndex);
        else if(substring.length > 0){
            if(cursor >= charIndex)
            {
                this.cursorPos[1] = yPos;
                const substrWidth:number = this.ctx.measureText(text.substring(charIndex, cursor)).width
                this.cursorPos[0] = substrWidth + x;
            }
            this.rows.push(new TextRow(substring, x, yPos, this.width() - x));
        }
        return new Pair(cursorOffset + charIndex, [x, i * this.fontSize + y]);
    }
    cursorRowIndex():number
    {
        let index:number = 0;
        for(let i = 0; i < this.rows.length; i++)
        {
            const row:TextRow = this.rows[i];
            if(row.y === Math.floor(this.cursor / this.fontSize))
                index = i;
        }
        return index;
    }
    adjustScrollToCursor():TextRow[]
    {
        let deltaY:number = 0;
        let deltaX:number = 0;
        if(this.top())
        {   
            if(this.cursorPos[1] > this.height() - this.fontSize)
            {
                deltaY += this.cursorPos[1] - this.fontSize;
            }
            else if(this.cursorPos[1] < this.fontSize)
            {
                deltaY -= this.cursorPos[1] + this.fontSize;
            }
        } 
        else if(this.center())
        {
            if(this.cursorPos[1] > this.height()/2 + this.fontSize/2)
            {
                deltaY += this.cursorPos[1] - this.height() + this.height()/2;
            }
            else if(this.cursorPos[1] < this.height()/2 + this.fontSize/2)
            {
                deltaY += this.cursorPos[1] - (this.height()/2);
            }
        }
        else
        {
            if(this.cursorPos[1] > this.height() - 3)
            {
                deltaY += this.cursorPos[1] - this.height() + this.fontSize/3;
            }
            else if(this.cursorPos[1] < this.height() - 3)
            {

                deltaY += this.cursorPos[1] - this.height() + this.fontSize/3;
            }
        }
        if(this.rows.length)
        {
            let freeSpace:number = this.width();// - this.rows[0].width;
            let maxWidth:number = 0;
            this.rows.forEach(el => {
                const width:number = this.ctx.measureText(el.text).width;
                if(freeSpace > this.width() - width)
                {
                    freeSpace = this.width() - width;
                    maxWidth = width;
                }
            });
            if(this.hcenter())
            {
                deltaX -= freeSpace / 2 - maxWidth / 2;
            }
            else if(this.left())
            {
                deltaX -= this.ctx.measureText("0").width / 3;
            }
            else if(this.right())
            {
                deltaX -= freeSpace + this.ctx.measureText("0").width / 3;
            }
        }
        const newRows:TextRow[] = [];
        this.rows.forEach(row => newRows.push(new TextRow(row.text, row.x - deltaX, row.y - deltaY, row.width)));
        this.scaledCursorPos[1] = this.cursorPos[1] - deltaY;
        this.scaledCursorPos[0] = this.cursorPos[0] - deltaX;
        return newRows;
    }
    drawRows(rows:TextRow[]):void
    {
        rows.forEach(row => {
            this.ctx.lineWidth = 4;
            if(row.width > this.width())
            {
                this.ctx.strokeText(row.text, 0, row.y, this.width());
                this.ctx.fillText(row.text, 0, row.y, this.width());
            }
            else
            {
                this.ctx.strokeText(row.text, row.x, row.y, row.width);
                this.ctx.fillText(row.text, row.x, row.y, row.width);
            }
        });
    }
    drawCursor():void{
        if(this.active() && this.handleKeyEvents)
        {
            this.ctx.fillStyle = "#000000";
            this.ctx.fillRect(this.scaledCursorPos[0], this.scaledCursorPos[1] - this.fontSize+3, 2, this.fontSize-2);
        }
    }
    color():RGB
    {
        if(this.active())
            return this.selectedColor;
        else
            return this.unSelectedColor;
    }
    refresh(): void {
        this.drawInternalAndClear();
    }
    drawInternalAndClear():void
    {
        this.setCtxState();
        this.ctx.clearRect(0, 0, this.width(), this.height());
        this.ctx.fillStyle = "#000000";
        this.rows.splice(0,this.rows.length);
        this.refreshMetaData();
        this.ctx.strokeStyle = "#FFFFFF";
        this.drawRows(this.adjustScrollToCursor());
        this.drawCursor();
        if(this.outlineTextBox)
        {
            this.ctx.strokeStyle = this.color().htmlRBG();
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(0, 0, this.width(), this.height());
        }
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number = 0, offsetY:number = 0)
    {
        ctx.clearRect(x + offsetX, y + offsetY, this.width(), this.height());
        ctx.drawImage(this.canvas, x + offsetX, y + offsetY);
    }
};
export class GuiLabel extends GuiButton {
    constructor(text:string, width:number, fontSize:number = 16, height:number = 2*fontSize)
    {
        super(() => {}, text, width, height, fontSize);
    }
    //override the textbox's handlers
    handleKeyBoardEvents(type:string, e:any):void {}
    handleTouchEvents(type:string, e:any):void {}
    active(): boolean {
        return false;
    }
};
export class GuiRadioGroup implements GuiElement {
    layout:SimpleGridLayoutManager;
    constructor(pixelDim:number[], matrixDim:number[])
    {
        this.layout = new SimpleGridLayoutManager(matrixDim, pixelDim, 0, 0);
    }
    active():boolean
    {
        return this.layout.active();
    }
    deactivate():void
    {
        this.layout.deactivate();
    }
    activate():void
    {
        this.layout.activate();
    }
    width():number
    {
        return this.layout.width();
    }
    height():number
    {
        return this.layout.height();
    }
    refresh():void
    {
        this.layout.refresh()
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number, offsetY:number): void
    {
        this.layout.draw(ctx, x, y, offsetX, offsetY);
    }
    handleKeyBoardEvents(type:string, e:any):void
    {
        this.layout.handleKeyBoardEvents(type, e);
    }
    handleTouchEvents(type:string, e:any):void
    {
        this.layout.handleTouchEvents(type, e);
    }
    isLayoutManager():boolean
    {
        return false;
    }
}
GuiTextBox.initGlobalText();
GuiTextBox.initGlobalNumbers();
GuiTextBox.initGlobalSpecialChars();
export class GuiToolBar implements GuiElement {
    tools:ToolBarItem[];
    focused:boolean;
    toolRenderDim:number[];
    toolsPerRow:number;//could also be per column depending on render settings
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    vertical:boolean
    selected:number;
    constructor(renderDim:number[], tools:Tool[] = []) {
        this.focused = false;
        this.selected = 0;
        this.vertical = true;
        this.toolsPerRow = 10;
        this.toolRenderDim = [renderDim[0], renderDim[1]];
        this.tools = tools;
        this.canvas = document.createElement("canvas");
        this.canvas.height = this.height();
        this.canvas.width = this.width();
        this.ctx = this.canvas.getContext("2d")!;
        this.ctx.strokeStyle = "#000000";
    }
    setImagesIndex(value:number):void
    {
        this.tools.forEach(tool => {
            if(tool.toolImages.length > value)
                tool.selected = value;
        });
    }
    resize(width:number = this.width(), height:number = this.height()):void
    {
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d")!;
        this.ctx.strokeStyle = "#000000";
    }
    active():boolean {
        return this.focused;
    }
    deactivate():void {
        this.focused = false;
    }
    activate():void {
        this.focused = true;
    }
    width():number {
        if(this.vertical)
            return this.toolRenderDim[0] * (1+Math.floor(this.tools.length / this.toolsPerRow));
        else
            return this.toolRenderDim[0] * this.toolsPerRow;
    }
    height():number {
        if(this.vertical)
            return this.toolRenderDim[1] * this.toolsPerRow;
        else
            return this.toolRenderDim[1] * (1+Math.floor(this.tools.length / this.toolsPerRow));
    }
    refresh():void {
        this.ctx.clearRect(0, 0, this.width(), this.height());
        for(let i = 0; i < this.tools.length; i++)
        {
            let gridX:number = 0;
            let gridY:number = 0;
            if(this.vertical)
            {
                const toolsPerColumn:number = this.toolsPerRow;
                gridX = Math.floor(i / toolsPerColumn);
                gridY = i % toolsPerColumn;
            }
            else
            {   
                gridX = i % this.toolsPerRow;
                gridY = Math.floor(i / this.toolsPerRow);
            }
            const pixelX:number = gridX * this.toolRenderDim[0];
            const pixelY:number = gridY * this.toolRenderDim[1];
            const image:HTMLImageElement | null = this.tools[i].image();
            if(image && image.width && image.height)
            {
                this.ctx.drawImage(image, pixelX, pixelY, this.toolRenderDim[0], this.toolRenderDim[1]);
            }
            if(this.selected === i)
            {
                this.ctx.strokeStyle = "#FFFFFF";
                this.ctx.strokeRect(pixelX + 3, pixelY + 3, this.toolRenderDim[0] - 6, this.toolRenderDim[1] - 6);
                this.ctx.strokeStyle = "#000000";
                this.ctx.strokeRect(pixelX + 1, pixelY + 1, this.toolRenderDim[0] - 2, this.toolRenderDim[1] - 2);
            }
        }
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, offsetX:number = 0, offsetY:number = 0) {
        ctx.drawImage(this.canvas, x + offsetX, y + offsetY);
    }
    handleKeyBoardEvents(type:string, e:any):void {}
    tool():ToolBarItem {
        return this.tools[this.selected];
    }
    handleTouchEvents(type:string, e:any):void {
        if(this.active())
        {
            switch(type){
                case("touchstart"):
                const x:number = Math.floor(e.touchPos[0] / this.toolRenderDim[0]);
                const y:number = Math.floor(e.touchPos[1] / this.toolRenderDim[1]);
                const clicked:number = this.vertical?y + x * this.toolsPerRow : x + y * this.toolsPerRow;
                if(clicked >= 0 && clicked < this.tools.length)
                {
                    this.selected = clicked;
                }
            }
            this.refresh();
        }
    }
    isLayoutManager():boolean {
        return false;
    }
};
export interface RenderablePalette {
    getColorAt(x:number, y:number):RGB;
    refresh():void;
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number):void;
};
//tbd
export class RGB24BitPalette implements RenderablePalette {
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    colorData:Int32Array;
    constructor()
    {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;
        this.colorData = <Int32Array> <any> null;
        this.refresh();
    }
    refresh():void 
    {

        this.colorData = new Int32Array(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data.buffer);
    }
    getColorAt(x:number, y:number):RGB 
    {
        return new RGB(0,0,0);
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number):void
    {

    }
};
export class ToolBarItem {
    toolImages:ImageContainer[];
    selected:number;
    constructor(toolName:string | string[], toolImagePath:string | string[], selected:number = 0)
    {
        this.selected = selected;
        this.toolImages = [];
        if(Array.isArray(toolName) && !(toolImagePath instanceof String) && toolName.length === toolImagePath.length)
        {
            for(let i = 0; i < toolName.length; i++)
                this.toolImages.push(new ImageContainer(toolName[i], toolImagePath[i]));
        }
        else if(!Array.isArray(toolName) && Array.isArray(toolImagePath))
        {
            for(let i = 0; i < toolName.length; i++)
                this.toolImages.push(new ImageContainer(toolName, toolImagePath[i]));
        }
        else if(Array.isArray(toolName) && Array.isArray(toolImagePath) && toolName.length !== toolImagePath.length)
            throw new Error("Invalid params for toolbar item both lists must be same length");
        else if(!Array.isArray(toolName) && !Array.isArray(toolImagePath))
        {
            this.toolImages.push(new ImageContainer(toolName, toolImagePath));
        }
        else if(!(toolName instanceof String) && (toolImagePath instanceof String))
        {
            throw new Error("Invalid params for toolbar item both params should be same type");
        }
    }
    imageContainer():ImageContainer {
        return this.toolImages[this.selected];
    }
    width():number
    {
        return this.imageContainer()!.image!.width;
    }
    height():number
    {
        return this.imageContainer()!.image!.height;
    }
    image():HTMLImageElement | null
    {
        if(this.imageContainer())
            return this.imageContainer()!.image!;
        return null
    }
    name():string
    {
        return this.imageContainer()!.name;
    }
    drawImage(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number)
    {
        if(this.image())
        {
            ctx.drawImage(this.image()!, x, y, width, height);
        }
    }
};
export abstract class Tool extends ToolBarItem{
    constructor(toolName:string, toolImagePath:string[])
    {
        super(toolName, toolImagePath);
    }
    abstract optionPanelSize():number[];
    abstract activateOptionPanel():void;
    abstract deactivateOptionPanel():void;
    abstract getOptionPanel():SimpleGridLayoutManager | null;
    abstract drawOptionPanel(ctx:CanvasRenderingContext2D, x:number, y:number):void;

};
export class ViewLayoutTool extends Tool {
    layoutManager:SimpleGridLayoutManager;
    constructor(layoutManager:SimpleGridLayoutManager, name:string, path:string[])
    {
        super(name, path);
        this.layoutManager = layoutManager;
    }

    activateOptionPanel():void { this.layoutManager.activate(); }
    deactivateOptionPanel():void { this.layoutManager.deactivate(); }
    getOptionPanel():SimpleGridLayoutManager | null {
        return this.layoutManager;
    }
    optionPanelSize():number[]
    {
        return [this.layoutManager.canvas.width, this.layoutManager.canvas.height];
    }
    drawOptionPanel(ctx:CanvasRenderingContext2D, x:number, y:number):void
    {
        const optionPanel:SimpleGridLayoutManager = this.getOptionPanel()!;
        optionPanel.x = x;
        optionPanel.y = y;
        optionPanel.draw(ctx, x, y);
    }
};
export class GenericTool extends Tool {
    constructor(name:string, imagePath:string[])
    {
        super(name, imagePath);
    }
    activateOptionPanel():void {}
    deactivateOptionPanel():void {}
    getOptionPanel():SimpleGridLayoutManager | null {
        return null;
    }
    optionPanelSize():number[]
    {
        return [0, 0];
    }
    drawOptionPanel(ctx:CanvasRenderingContext2D, x:number, y:number):void {}
};
export class ExtendedTool extends ViewLayoutTool {
    localLayout:SimpleGridLayoutManager;
    optionPanels:SimpleGridLayoutManager[];
    constructor(name:string, path:string[], optionPanes:SimpleGridLayoutManager[], dim:number[], matrixDim:number[] = [24, 24], parentMatrixDim:number[] = [24, 48])
    {
        super(new SimpleGridLayoutManager([parentMatrixDim[0],parentMatrixDim[1]], [dim[0], dim[1]]), name, path);
        this.localLayout = new SimpleGridLayoutManager([matrixDim[0],matrixDim[1]], [dim[0], dim[1]]);
        const parentPanel:SimpleGridLayoutManager = this.getOptionPanel()!;
        parentPanel.addElement(this.localLayout);
        this.optionPanels = [this.localLayout];
        let maxY:number = this.localLayout.height();
        let maxX:number = this.localLayout.width();
        optionPanes.forEach((pane:any) => {
            parentPanel.addElement(pane);
            this.optionPanels.push(pane);
            maxY += pane.height();
        });
        parentPanel.setHeight(maxY);
        parentPanel.setWidth(maxX);
        parentPanel.refreshMetaData();
        maxY = 0;
        parentPanel.elementsPositions.forEach(el => {
            if(el.y + el.height > maxY)
            {
                maxY = el.y + el.height;
            }
        });
        parentPanel.setWidth(maxX);
        parentPanel.setHeight(dim[1] + maxY);
        parentPanel.refreshMetaData();

    }
    activateOptionPanel(): void {
        this.getOptionPanel()!.activate();
        this.optionPanels.forEach(element => {
            element.activate();
        });
    }
    deactivateOptionPanel(): void {
        this.getOptionPanel()!.deactivate();
        this.optionPanels.forEach(element => {
            element.deactivate();
        });
    }
};
export class SingleCheckBoxTool extends GenericTool {
    optionPanel:SimpleGridLayoutManager;
    checkBox:GuiCheckBox;
    constructor(label:string, name:string, imagePath:string[], callback:() => void = () => null)
    {
        super(name, imagePath);
        this.optionPanel = new SimpleGridLayoutManager([1,4], [200, 90]);
        this.checkBox = new GuiCheckBox(callback, 40, 40);
        this.optionPanel.addElement(new GuiLabel(label, 200, 16, GuiTextBox.bottom, 40));
        this.optionPanel.addElement(this.checkBox);
    }
    activateOptionPanel():void { this.optionPanel.activate(); }
    deactivateOptionPanel():void { this.optionPanel.deactivate(); }
    getOptionPanel():SimpleGridLayoutManager | null {
        return this.optionPanel;
    }
    optionPanelSize():number[]
    {
        return [this.optionPanel.width(), this.optionPanel.height()];
    }
    drawOptionPanel(ctx:CanvasRenderingContext2D, x:number, y:number):void {
        const optionPanel:SimpleGridLayoutManager = this.getOptionPanel()!;
        optionPanel.x = x;
        optionPanel.y = y;
        optionPanel.draw(ctx, x, y);
    }
};

export function buildSpriteFromBuffer(buffer:Int32Array, index:number):Pair<Sprite, number>
{
    const size:number = buffer[index++];
    const type:number = buffer[index++];
    const height:number = buffer[index] >> 16;
    const width:number = buffer[index++] & ((1 << 17) - 1);
    const sprite:Sprite = new Sprite([], width, height);
    if(type !== 3)
        throw new Error("Corrupted project file sprite type should be: 3, but is: " + type.toString());
    if(width * height !== size - 3)
        throw new Error("Corrupted project file, sprite width, and height are: (" + width.toString() +","+ height.toString() + "), but size is: " + size.toString());
    const limit:number = width * height;
    const view:Int32Array = new Int32Array(sprite.pixels.buffer);
    for(let i = 0; i < limit; i++)
    {
        view[i] = buffer[index];
        index++;
    }
    sprite.refreshImage();
    return new Pair(sprite, size);
}
export function buildSpriteAnimationFromBuffer(buffer:Int32Array, index:number):Pair<SpriteAnimation, number>
{
    const size:number = buffer[index++];
    const type:number = buffer[index++];
    const width:number = buffer[index + 2] >> 16;
    const height:number = buffer[index + 2] & ((1 << 16) - 1);
    if(type !== 2)
        throw new Error("Corrupted project file animation type should be: 2, but is: " + type.toString());
    let i:number = 2;
    const animation:SpriteAnimation = new SpriteAnimation(0, 0, width, height);

    for(; i < size - 2;)
    {
        const result:Pair<Sprite, number> = buildSpriteFromBuffer(buffer, index);
        index += result.second;
        i += result.second;
        animation.pushSprite(result.first);
    }
    let spriteMemory:number = 0;
    animation.sprites.forEach((sprite:Sprite) => spriteMemory += (sprite.pixels.length >> 2) + 3);
    if(spriteMemory !== size - 2)
        throw new Error("Error invalid group size: " + size.toString() + " should be: " + size.toString());
    return new Pair(animation, size);
}
export class Sprite {
    pixels:Uint8ClampedArray;
    imageData:ImageData | null;
    image:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    fillBackground:boolean;
    width:number;
    height:number;
    constructor(pixels:Array<RGB>, width:number, height:number, fillBackground:boolean = false)
    {
        this.fillBackground = fillBackground;
        this.imageData = null;
        this.pixels = null;
        this.image = document.createElement("canvas");
        this.ctx = this.image.getContext("2d", {desynchronized:true})!;
        this.width = width;
        this.height = height;
        if(width * height > 0)
            this.copy(pixels, width, height);
    }
    copyCanvas(canvas:HTMLCanvasElement):void
    {
        this.width = canvas.width;
        this.height = canvas.height;
        this.image.width = this.width;
        this.image.height = this.height;
        this.ctx = this.image.getContext("2d")!;
        
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(canvas, 0, 0);
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        this.pixels = this.imageData.data;
    }
    flipHorizontally(): void
    {
        
        let left:RGB = new RGB(0,0,0,0);
        let right:RGB = new RGB(0,0,0,0);
        for(let y = 0; y < this.height; y++)
        {
            const yOffset:number = y * this.width;
            for(let x = 0; x < this.width << 1; x++)
            {
                left.color = this.pixels[x + yOffset];
                right.color = this.pixels[yOffset + (this.width - 1) - x];
                if(left && right)
                {
                    const temp:number = left.color;
                    left.copy(right);
                    right.color = temp;
                }
            }
        }
        this.refreshImage(); 
    }
    copyImage(image:HTMLImageElement):void
    {
        console.log(image.width, image.height)
        this.width = image.width;
        this.height = image.height;
        this.image.width = this.width;
        this.image.height = this.height;
        this.ctx = this.image.getContext("2d")!;
        
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(image, 0, 0);
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        this.pixels = this.imageData.data;
    }
    createImageData():ImageData {

        const canvas = this.image;
        if(canvas.width !== this.width || canvas.height !== this.height)
        {
            canvas.width = this.width;
            canvas.height = this.height;
        }
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false;

        return this.ctx.createImageData(this.width, this.height);
    }
    copy(pixels:Array<RGB>, width:number, height:number):void
    {

        this.width = width;
        this.height = height;
        if(width !== 0 && height !== 0)
        {
            if(!this.pixels || this.pixels.length !== pixels.length || this.pixels.length > 0)
            {
                this.imageData = this.createImageData();
                this.pixels = this.imageData.data;
            }
            const view:Int32Array = new Int32Array(this.pixels.buffer)
            for(let i = 0; i < pixels.length; i++)
            {
                view[i] = pixels[i].color;
            }
            if(pixels.length)
                this.refreshImage();
        }
    }
    putPixels(ctx:CanvasRenderingContext2D):void
    {
        if(this.imageData)
            ctx.putImageData(this.imageData, 0, 0);
    }
    fillRect(color:RGB, x:number, y:number, width:number, height:number, view:Int32Array = new Int32Array(this.pixels.buffer))
    {
        for(let yi = y; yi < y+height; yi++)
        {
            const yiIndex:number = (yi*this.width);
            const rowLimit:number = x + width + yiIndex;
            for(let xi = x + yiIndex; xi < rowLimit; xi++)
            {
                view[xi] = color.color;
            }
        }
    }
    fillRectAlphaBlend(source:RGB, color:RGB, x:number, y:number, width:number, height:number, view:Int32Array = new Int32Array(this.pixels.buffer))
    {
        for(let yi = y; yi < y+height; yi++)
        {
            for(let xi = x; xi < x+width; xi++)
            {
                let index:number = (xi) + (yi*this.width);
                source.color = view[index];
                source.blendAlphaCopy(color);
                view[index] = source.color;
            }
        }
    }
    copyToBuffer(buf:Array<RGB>, width:number, height:number, view:Int32Array = new Int32Array(this.pixels.buffer))
    {
        if(width * height !== buf.length)
        {
            console.log("error invalid dimensions supplied");
            return;
        }
        for(let y = 0; y < this.height && y < height; y++)
        {
            for(let x = 0; x < this.width && x < width; x++)
            {
                const i:number = (x + y * width);
                const vi:number = x + y * this.width;
                buf[i].color = view[vi];
            }
        }
    }
    binaryFileSize():number
    {
        return 3 + this.width * this.height;
    }
    saveToUint32Buffer(buf:Int32Array, index:number, view:Int32Array = new Int32Array(this.pixels.buffer)):number
    {
        buf[index++] = this.binaryFileSize();
        buf[index++] = 3;
        buf[index] |= this.height << 16; 
        buf[index++] |= this.width; 
        for(let i = 0; i < view.length; i++)
        {
            buf[index] = view[i];
            index++;
        }
        return index;
    }
    refreshImage():void 
    {
        const canvas = this.image;
        if(canvas.width !== this.width || canvas.height !== this.height)
        {
            canvas.width = this.width;
            canvas.height = this.height;
            this.ctx = canvas.getContext("2d")!;
        }
        this.putPixels(this.ctx);
    }
    copySprite(sprite:Sprite):void
    {
        this.width = sprite.width;
        this.height = sprite.height;
        this.imageData = this.createImageData();
        this.pixels = this.imageData.data;
        for(let i = 0; i < this.pixels.length;)
        {
            this.pixels[i] = sprite.pixels[i++];
            this.pixels[i] = sprite.pixels[i++];
            this.pixels[i] = sprite.pixels[i++];
            this.pixels[i] = sprite.pixels[i++];
        }
    }
    copySpriteBlendAlpha(sprite:Sprite):void
    {
        if(this.pixels.length !== sprite.pixels.length){
            this.imageData = this.createImageData();
            this.pixels = this.imageData.data;
        }
        this.width = sprite.width;
        this.height = sprite.height;
        const o:RGB = new RGB(0, 0, 0, 0);
        const t:RGB = new RGB(0, 0, 0, 0);

        for(let i = 0; i < this.pixels.length; i += 4)
        {
            o.setRed(sprite.pixels[i]);
            o.setGreen(sprite.pixels[i+1]);
            o.setBlue(sprite.pixels[i+2]);
            o.setAlpha(sprite.pixels[i+3]);
            t.setRed(this.pixels[i]);
            t.setGreen(this.pixels[i+1]);
            t.setBlue(this.pixels[i+2]);
            t.setAlpha(this.pixels[i+3]);
            t.blendAlphaCopy(o);
            this.pixels[i] = t.red();
            this.pixels[i+1] = t.green();
            this.pixels[i+2] = t.blue();
            this.pixels[i+3] = t.alpha();
        }
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number):void
    {
        if(this.pixels){ 
            if(this.fillBackground){
                ctx.clearRect(x, y, width, height);
            }
            ctx.drawImage(this.image, x, y, width, height);
        }
    }
};
export class SpriteAnimation {
    sprites:Sprite[];
    x:number;
    y:number;
    width:number;
    height:number;
    animationIndex:number;

    constructor(x:number, y:number, width:number, height:number)
    {
        this.sprites = [];
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.animationIndex = 0;
    }
    pushSprite(sprite:Sprite):void
    {
        this.sprites.push(sprite);
    }
    binaryFileSize():number
    {
        let size:number = 2;
        this.sprites.forEach((sprite:Sprite) => size += sprite.binaryFileSize());
        return size;
    }
    toGifBlob(callBack:(blob:Blob) => void, fps:number = 30):void
    {
        const frameTime:number = 1000/fps;
        const gif = new GIF({
            workers: 2,
            quality: 10
          });
          // add an image element
          for(let i = 0; i < this.sprites.length; i++)
            gif.addFrame(this.sprites[i].image, {delay:Math.ceil(frameTime)});
          
          gif.on('finished', function(blob:Blob) {
            callBack(blob);
          });
          
          gif.render();
    }
    saveToUint32Buffer(buf:Int32Array, index:number):number
    {
        buf[index++] = this.binaryFileSize();
        buf[index++] = 2;
        this.sprites.forEach((sprite:Sprite) => index = sprite.saveToUint32Buffer(buf, index));
        return index;
    }
    cloneAnimation():SpriteAnimation
    {
        
        const cloned:SpriteAnimation = new SpriteAnimation(0, 0, this.width, this.height);
        const original:SpriteAnimation = this;
        original.sprites.forEach((sprite:Sprite) => {
            const clonedSprite:Sprite = new Sprite([], sprite.width, sprite.height);
            clonedSprite.copySprite(sprite);
            clonedSprite.refreshImage();
            cloned.sprites.push(clonedSprite);
        });
        return cloned;
    }
    draw(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number):void
    {
        if(this.sprites.length){
            ++this.animationIndex;
            this.sprites[this.animationIndex %= this.sprites.length].draw(ctx, x, y, width, height);
        }
        else{
            this.animationIndex = -1;
        }
    }
};
let width:number = Math.min(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );
let height:number = Math.min(
    //document.body.scrollHeight,
    //document.documentElement.scrollHeight,
    //document.body.offsetHeight,
    //document.documentElement.offsetHeight//,
    document.body.clientHeight
  );
window.addEventListener("resize", () => {
    width = Math.min(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.body.clientWidth
      );
    height = document.body.clientHeight;
});
export function getWidth():number {
    return width;
}
export function getHeight():number {
    return height;
}
export class RegularPolygon {
    points:number[];
    bounds:number[];
    sides:number;
    constructor(radius:number, sides:number)
    {
        this.points = [];
        this.sides = sides;
        if(sides <= 2)
            throw "Error polygon must have at least 3 sides";
        this.resize_radius(radius);
    }
    resize_radius(radius:number):void
    {
        this.points = [];
        const side_length = 2 * radius * Math.sin(Math.PI/this.sides);
        const exterior_angle = (2 * Math.PI / this.sides);
        let xi = 0;
        let yi = 0;
        this.bounds = [max_32_bit_signed, max_32_bit_signed, -max_32_bit_signed, -max_32_bit_signed];
        for(let i = 0; i < this.sides; i++)
        {
            const dx = side_length * Math.cos(exterior_angle * i);
            const dy = side_length * Math.sin(exterior_angle * i);
            xi = xi + dx;
            yi = yi + dy;
            this.points.push(xi);
            this.points.push(yi);
            if(xi < this.bounds[0])
            {
                this.bounds[0] = xi;
            }
            if(xi > this.bounds[2])
            {
                this.bounds[2] = xi;
            }
            if(yi < this.bounds[1])
            {
                this.bounds[1] = yi;
            }
            if(yi > this.bounds[3])
            {
                this.bounds[3] = yi;
            }
        }
    }
    width():number
    {
        return this.max_x() - this.min_x();
    }
    height():number
    {
        return this.max_y() - this.min_y();
    }
    min_x():number
    {
        return this.bounds[0];
    }
    max_x():number
    {
        return this.bounds[2];
    }
    min_y():number
    {
        return this.bounds[1];
    }
    max_y():number
    {
        return this.bounds[3];
    }
    render(ctx:CanvasRenderingContext2D, x:number, y:number):void
    {

        ctx.moveTo(x - this.bounds[0], y);
        for(let i = 0; i < this.points.length; i += 2)
        {
            ctx.lineTo(this.points[i] - this.bounds[0] + x, this.points[i + 1] + y);
        }
        ctx.stroke();
    }
    render_funky(ctx:CanvasRenderingContext2D, x:number, y:number):void
    {
        ctx.moveTo(x - this.min_x(), y);
        for(let i = 0; i < this.points.length; i += 2)
        {
            ctx.lineTo(this.points[0] - this.min_x(), this.points[1] - this.min_x());
            ctx.lineTo(this.points[i] - this.min_x(), this.points[i + 1]);
        }
        ctx.stroke();
    }
};
export function render_regular_polygon(ctx:CanvasRenderingContext2D, radius:number, sides:number, x:number, y:number):void
{
    if(sides <= 2)
        return;
    ctx.beginPath();
    const side_length = 2 * radius * Math.sin(Math.PI/sides);
    const exterior_angle = (2 * Math.PI / sides);
    let xi = 0;
    let yi = 0;
    let points:number[] = [];
    let lowest_x = 1000000;
    let bounds:number[] = [max_32_bit_signed, max_32_bit_signed, -1, -1];
    for(let i = 0; i < sides; i++)
    {
        const dx = side_length * Math.cos(exterior_angle * i);
        const dy = side_length * Math.sin(exterior_angle * i);
        xi = xi + dx;
        yi = yi + dy;
        points.push(xi + x);
        points.push(yi + y);
        if(xi < lowest_x)
        {
            lowest_x = xi;
        }
    }
    ctx.moveTo(x - lowest_x, y);
    for(let i = 0; i < points.length; i += 2)
    {
        ctx.lineTo(points[i] - lowest_x, points[i + 1]);
    }
    ctx.stroke();
}
export function render_funky_regular_polygon(ctx:CanvasRenderingContext2D, radius:number, sides:number, x:number, y:number):void
{
    if(sides <= 2)
        return;
    ctx.beginPath();
    const side_length = 2 * radius * Math.sin(Math.PI/sides);
    const exterior_angle = (2 * Math.PI / sides);
    let xi = 0;
    let yi = 0;
    let points:number[] = [];
    let lowest_x = 1000000;
    for(let i = 0; i < sides; i++)
    {
        const dx = side_length * Math.cos(exterior_angle * i);
        const dy = side_length * Math.sin(exterior_angle * i);
        xi = xi + dx;
        yi = yi + dy;
        points.push(xi + x);
        points.push(yi + y);
        if(xi < lowest_x)
        {
            lowest_x = xi;
        }
    }
    ctx.moveTo(x - lowest_x, y);
    for(let i = 0; i < points.length; i += 2)
    {
        ctx.lineTo(points[0] - lowest_x, points[1] - lowest_x);
        ctx.lineTo(points[i] - lowest_x, points[i + 1]);
    }
    ctx.stroke();
}