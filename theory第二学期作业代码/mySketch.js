const zSpacing = 100;
let IA;
// === 相机控制相关 ===
let camPos;                // 摄像机位置
let yaw = 0, pitch = 0;    // 水平/垂直视角（弧度）
const moveSpeed = 200;     // 移动速度（像素/秒，可按需调）
const lookSens = 0.005;    // 鼠标灵敏度
let keyState = {};         // 存放按键按下状态
let lastCamPos;            // 用于跟踪相机上次位置
// ======================

let bg, info;
let baseCloud, cloudImg;
let geomId = 0;
let shapes;

// 添加白色雕塑相关变量
let objects;
let nblocks = 10;
const nobjects = 50;
const gridSize = 8;
const cellSize = 5;

// 新增全局变量：存储所有形状的位置和大小
let shapesPositions = [];
// 形状之间的最小距离
const MIN_SHAPE_DISTANCE = 60;

// --------------------------------------------------------------- //
// loading.

// 毎度おなじみループ雲画像（便利）
function preload(){
  cloudImg = loadImage("https://inaridarkfox4231.github.io/assets/texture/cloud.png");
}

// --------------------------------------------------------------- //
// main.

// 初始化
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  camPos = createVector(0, 0, 500);
  lastCamPos = camPos.copy();
  
  // 初始化目标视角为当前视角
  targetYaw = yaw;
  targetPitch = pitch;
  
  // これでいいの？？
  IA = new foxIA.Interaction(this.canvas, {factory:(function (){
    return new ShapePointer(this.width, this.height, this._renderer);
  }).bind(this)});
  // 初期化したら後には戻れない...
  //IA.initialize(this.canvas); // canvasで初期化
  
  fill(255);
  noStroke();
  
  shapes = new CrossReferenceArray();
  shapesPositions = []; // 初始化形状位置数组
  
  bg = createGraphics(width, height); // bg.
  baseCloud = createGraphics(width, height, WEBGL); // baseCloud.

  info = createGraphics(width, height); // info.
  info.textStyle(ITALIC);
  info.translate(width / 2, height / 2);

  // 创建按钮（左上角）
  createOrientationButtons();

  // カリングを適用します
  const gl = this._renderer.GL;
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT);
  
  // 白色雕塑を生成
  // 初次生成
generate();

// 每 40 秒增加一次 nblocks，直到 200 为止
setInterval(() => {
  if (nblocks < 360) {
    // 加 70，但不超过 360
    nblocks = Math.min(nblocks + 70, 360);
    console.log(`nblocks increased to ${nblocks}`);
    generate();
  }
}, 30 * 1000);

  
  console.log("Setup complete. Use Alt/Option + drag to draw shapes.");
  console.log("You can select orientation using the buttons in the top-left corner:");
  console.log("- XZ plane (ground): Horizontal");
  console.log("- XY plane (vertical, facing Z): Frontal");
  console.log("- ZY plane (vertical, facing X): Transverse");
}

// 创建朝向选择按钮
function createOrientationButtons() {
  // 创建三个按钮，分别对应三种平面
  let buttonWidth = 120;
  let buttonHeight = 40;
  let margin = 10;
  
  // 平躺的按钮 - XZ平面 (Horizontal plane)
  buttonXZ = createButton('Horizontal');
  buttonXZ.position(margin, margin);
  buttonXZ.size(buttonWidth, buttonHeight);
  buttonXZ.style('background-color', 'rgb(185, 211, 238)'); // 蓝色
  buttonXZ.style('color', 'white');
  buttonXZ.style('border', 'none');
  buttonXZ.style('border-radius', '4px');
  buttonXZ.style('font-size', '14px');
  buttonXZ.style('cursor', 'pointer');
  buttonXZ.mousePressed(function() {
    selectedPlaneType = 0;
    updateButtonStyles();
  });
  
  // 垂直面按钮 - XY平面，垂直于Z轴 (Frontal plane)
  buttonXY = createButton('Frontal');
  buttonXY.position(margin, margin + buttonHeight + 10);
  buttonXY.size(buttonWidth, buttonHeight);
  buttonXY.style('background-color', '#f1f1f1');
  buttonXY.style('color', 'black');
  buttonXY.style('border', 'none');
  buttonXY.style('border-radius', '4px');
  buttonXY.style('font-size', '14px');
  buttonXY.style('cursor', 'pointer');
  buttonXY.mousePressed(function() {
    selectedPlaneType = 1;
    updateButtonStyles();
  });
  
  // 垂直面按钮 - ZY平面，垂直于X轴 (Transverse plane)
  buttonZY = createButton('Transverse');
  buttonZY.position(margin, margin + 2 * (buttonHeight + 10));
  buttonZY.size(buttonWidth, buttonHeight);
  buttonZY.style('background-color', '#f1f1f1');
  buttonZY.style('color', 'black');
  buttonZY.style('border', 'none');
  buttonZY.style('border-radius', '4px');
  buttonZY.style('font-size', '14px');
  buttonZY.style('cursor', 'pointer');
  buttonZY.mousePressed(function() {
    selectedPlaneType = 2;
    updateButtonStyles();
  });
}

// 更新按钮样式，高亮显示当前选中的按钮
function updateButtonStyles() {
  // 重置所有按钮样式
  buttonXZ.style('background-color', '#f1f1f1');
  buttonXZ.style('color', 'black');
  
  buttonXY.style('background-color', '#f1f1f1');
  buttonXY.style('color', 'black');
  
  buttonZY.style('background-color', '#f1f1f1');
  buttonZY.style('color', 'black');
  
  // 设置选中按钮的样式，使用新的颜色
  switch(selectedPlaneType) {
    case 0:
      buttonXZ.style('background-color', 'rgb(185, 211, 238)'); // 蓝色
      buttonXZ.style('color', 'white');
      break;
    case 1:
      buttonXY.style('background-color', 'rgb(205,183,181)'); // 紫色
      buttonXY.style('color', 'white');
      break;
    case 2:
      buttonZY.style('background-color', 'rgb(139, 136, 120)'); // 绿色
      buttonZY.style('color', 'white'); // 白色字，按要求修改
      break;
  }
}

// 白色雕塑生成関数
function generate() {
  // 定义指定的颜色数组
  const sculptureColors = [
    color(238, 213, 210), // 浅紫色
    color(139, 139, 131)  // 浅灰色
  ];
  
  let cells = [];
  for (let x = -gridSize; x < gridSize; x++)
    for (let y = -gridSize; y < gridSize; y++)
      cells.push({x: cellSize * x, y: cellSize * y});
  shuffle(cells, true);
  objects = [];
  for (let i = 0; i < nobjects; i++) {
    let blockObject = new BlockObject(nblocks);
    let mesh = blockObject.mesh;
    if (typeof subdivide === 'function') {
      mesh = subdivide(subdivide(mesh, true), true);
    }
    let object = cells.pop();
    object.mesh = mesh;
    // 为每个雕塑交替分配颜色
    object.color = sculptureColors[i % 2]; // 交替使用两种颜色
    objects.push(object);
  }
}

// p5.js 的 mouseDragged 事件
function mouseDragged(event) {
  if (event.altKey) {
    // —— Option + 拖动：启动画笔（不切换视角）——
    // 返回 true，让 foxIA.PointerPrototype 接收到 mouseMoveAction
    return true;
  } else {
    // —— 普通拖动：切换视角（不启动画笔）——
    // 更新目标视角，而不是直接更新当前视角
    targetYaw   -= event.movementX * lookSens;
    targetPitch -= event.movementY * lookSens;
    targetPitch = constrain(targetPitch, -PI/2 + 0.01, PI/2 - 0.01);
    // 返回 false，阻止 PointerPrototype 收到 mouseMoveAction
    return false;
  }
}

function draw() {
  //shapes.loop("updateMove");

  clear();
  background(0); // 黑色背景
  
  // 平滑插值摄像机旋转角度
  yaw = lerp(yaw, targetYaw, smoothFactor);
  pitch = lerp(pitch, targetPitch, smoothFactor);
  
  const dt = deltaTime / 1000;  // 秒
  // 计算朝向与侧向向量（基于相机视角）
  let forward = createVector(
    -cos(pitch) * sin(yaw),  // X方向 
    sin(pitch),              // Y方向（允许上下看时上下移动）
    -cos(pitch) * cos(yaw)   // Z方向
  );
  let right = p5.Vector.cross(forward, createVector(0, 1, 0)).normalize();
  
  // 修正移动方向 - 确保W是前进，S是后退
  if (keyIsDown(87)) camPos.add(p5.Vector.mult(forward, moveSpeed * dt));  // W - 前进
  if (keyIsDown(83)) camPos.sub(p5.Vector.mult(forward, moveSpeed * dt));  // S - 后退
  if (keyIsDown(65)) camPos.sub(p5.Vector.mult(right, moveSpeed * dt));    // A - 左移
  if (keyIsDown(68)) camPos.add(p5.Vector.mult(right, moveSpeed * dt));    // D - 右移

  // —— 2. 设置摄像机 ——  
  camera(
    camPos.x, camPos.y, camPos.z,                // 摄像机位置
    camPos.x - cos(pitch)*sin(yaw),               // 目标点 X
    camPos.y + sin(pitch),                        // 目标点 Y
    camPos.z - cos(pitch)*cos(yaw),               // 目标点 Z
    0, 1, 0                                       // up 方向
  );
  
  // 注释掉原来的云背景
  // drawBackground(width, height, millis()/12000, millis()/16000);

  // 设置光照（复刻mySketch.js中的打光方式）
  ambientLight(128, 128, 128);
  let t = millis() / 10000 * PI;
  let [s, c] = [sin(t), cos(t)];
  directionalLight(128, 128, 128, s, c, -2);
  directionalLight(128, 128, 128, c, s, 2);

  // 添加地面（来自白色雕塑场景）
  push();
  fill('green');
  noStroke();
  translate(0, 0.9 * cellSize / 2, 0);
  rotateX(-PI / 2);
  circle(0, 0, 2000);
  pop();

  // 绘制白色雕塑
  push();
  const R = min(width, height) * 0.3;
  scale(R / cellSize);
  translate(0, 0, -R * 0.4 / cellSize);
  
  // 绘制原有的 objects，使用分配的颜色
  for (let {x, y, mesh, color} of objects) {
    push();
    translate(x, 0, y);
    let geom = mesh.p5Geometry;
    noStroke();
    if (color) {
      // 使用对象的颜色（如果有）
      fill(color);
    } else {
      // 默认颜色
      fill(255);
    }
    model(geom);
    pop();
  }
  pop();

  // 渲染用户创建的形状
  specularMaterial(64);
  shapes.loop("display");
  
  info.clear();
  shapes.loop("drawGuide", [info]);
  if (shapes.length===0) {
    const TEXT_SIZE = min(width, height)*0.02;
    info.fill(255);
    info.noStroke();
    info.textSize(min(width, height)*0.02);
    info.textAlign(CENTER, CENTER);
    
    // 根据当前选择的平面类型，显示不同的提示信息
    let orientationText = "";
    switch(selectedPlaneType) {
      case 0:
        orientationText = "Horizontal plane (ground)";
        break;
      case 1:
        orientationText = "Frontal plane (vertical)";
        break;
      case 2:
        orientationText = "Transverse plane (vertical)";
        break;
    }
    
    info.text("Hold Option/Alt and drag to draw", 0, -TEXT_SIZE*0.65);
    info.text("Shape will be placed on the " + orientationText, 0, TEXT_SIZE*0.65);
  }
  // 删除了左上角显示帧率的代码

  // どれよりも上に描画する. bgCam? そんなものいらないわ

  push();
  camera(0,0,1,0,0,0,0,1,0);
  ortho(-1,1,-1,1,0,1);
  translate(0,0,1);
  noLights();
  texture(info);
  plane(2);
  pop();

  shapes.loopReverse("remove");
}

// 添加全局变量，用于相机平滑插值
let targetYaw = 0;
let targetPitch = 0;
const smoothFactor = 0.1; // 视角平滑系数，越小越平滑

// 添加全局变量，用于按钮和选择形状朝向
let buttonXZ;  // 平躺
let buttonXY;  // 垂直面（Z轴法向）
let buttonZY;  // 垂直面（X轴法向）
let selectedPlaneType = 0; // 默认选择平躺(XZ平面)

// 动く雲画像（注释掉，不再使用）
/*
function drawBackground(w, h, s, t){
  s = fract(s);
  t = fract(t);
  baseCloud.texture(cloudImg);
  baseCloud.textureMode(NORMAL);
  baseCloud.textureWrap(REPEAT);
  const wRatio = w/(3*cloudImg.width);
  const hRatio = h/(3*cloudImg.height);
  baseCloud.beginShape();
  baseCloud.vertex(-w/2, -h/2, s, t);
  baseCloud.vertex(w/2, -h/2, s + wRatio, t);
  baseCloud.vertex(w/2, h/2, s + wRatio, t + hRatio);
  baseCloud.vertex(-w/2, h/2, s, t + hRatio);
  baseCloud.endShape();
  bg.blendMode(BLEND);
  bg.image(baseCloud, 0, 0);
  bg.blendMode(SCREEN);
  bg.background(64, 128, 255);

  // どれよりも下に描画する. bgCam要らん。
  push();
  camera(0,0,1,0,0,0,0,1,0);
  ortho(-1,1,-1,1,0,1);
  noLights();
  texture(bg);
  plane(2);
  pop();
}
*/

// --------------------------------------------------------------- //
// createShape3D.

// utility for create shapes.
function findCenter(vectors) {
  const center = createVector();
  for (let i = 0; i < vectors.length; i++) {
    center.add(vectors[i]);
  }
  center.div(vectors.length);

  for (let i = 0; i < vectors.length; i++) {
    vectors[i].sub(center);
  }

  return center;
}

function createShape3D(gId, vectors){
  console.log(`Creating shape ${gId} with ${vectors.length} vectors`);
  
  try {
    fisceToyBox.evenlySpacing(vectors, {minLength:24,closed:true});
    fisceToyBox.quadBezierize(vectors, {detail:8, closed:true});
    fisceToyBox.evenlySpacing(vectors, {minLength:12,closed:true});

    const cycles = fisceToyBox.createDisjointPaths([vectors], {output:"cycle_vertices"});
    const result = fisceToyBox.cyclesToCycles(cycles.cycles);
    const mesh = fisceToyBox.createBoardMeshFromCycles({result:result, thick:20});

    // バッファ作成 - 使用正确的上下文
    console.log("Creating buffers...");
    this.createBuffers(gId, mesh);
    console.log(`Buffers created for ${gId}`);
  } catch (error) {
    console.error("Error in createShape3D:", error);
  }
}

// --------------------------------------------------------------- //
// Pointer.

// PointerPrototypeの継承
// ShapeMeshをインタラクションによりジェネレートするユニット。
// うまくいきましたね。
class ShapePointer extends foxIA.PointerPrototype {
  constructor(w, h, _gl) {
    super();
    this.w = w;
    this.h = h;
    this.renderer = _gl;
    this.shape = undefined;
  }

  mouseDownAction(e) {
    // 只有按住 Option/Alt 时，才创建新 shape
    if (!e.altKey) return;
    this.shape = new ShapeMesh(this.renderer);
    this.shape.initialize(
      this.x - this.w/2,
      this.y - this.h/2
    );
    shapes.add(this.shape);
  }

  mouseMoveAction(e) {
    // 只有按住 Option/Alt 且已有 shape 时，才添加顶点
    if (!e.altKey || !this.shape) return;
    this.shape.addVertex(
      this.x - this.w/2,
      this.y - this.h/2
    );
  }

  mouseUpAction(e) {
    // 只有按住 Option/Alt 且已有 shape 时，才 complete
    if (!e.altKey || !this.shape) return;
    this.shape.complete();
  }

  // 如果不需要触屏受 Option 限制，可以保留原逻辑：
  touchStartAction(t) {
    this.shape = new ShapeMesh(this.renderer);
    this.shape.initialize(
      this.x - this.w/2,
      this.y - this.h/2
    );
    shapes.add(this.shape);
  }
  touchMoveAction(t) {
    this.shape.addVertex(
      this.x - this.w/2,
      this.y - this.h/2
    );
  }
  touchEndAction(t) {
    this.shape.complete();
  }
}

// --------------------------------------------------------------- //
// shape3D.

// ShapeMesh(shape3D)
// addVertexはマウスないしはタッチポインタが動くたびに呼び出せばいい
// drawGuideは毎フレームですね
// 要するに発火時に両方に登録するわけ
class ShapeMesh{
  constructor(_gl){
    this.active = false;
    this.closed = false;
    this.completed = false;
    this.vectors = [];
    this.position = createVector();
    
    // 使用全局selectedPlaneType来决定平面类型
    this.planeType = selectedPlaneType;
    
    // 添加缩放属性
    this.scale = random(0.7, 1.5);
    this.shapeColor = color(0); // 描画中の色
    this.life = 3;
    this.alive = true;
    this.gId = -1;
    this.renderer = _gl;
    // 是否已找到有效位置
    this.hasValidPosition = false;
  }
  
  kill(){
    this.alive = false;
  }
  
  initialize(x, y){
    // x,yは事前にセンタリング済み
    this.active = true;
    this.vectors.push(createVector(x, y, 0));
    
    // 使用HSB模式生成更丰富多彩的颜色
    colorMode(HSB, 360, 100, 100);
    const hue = random(0, 360);
    const saturation = random(70, 100);
    const brightness = random(70, 100);
    this.shapeColor = color(hue, saturation, brightness);
    colorMode(RGB, 255); // 切换回RGB模式
  }
  
  addVertex(x, y){
    if(this.completed){ return; }
    // x,yは事前にセンタリング済み
    // closedでない場合のみ発動
    if (!this.closed) {
      const v = createVector(x, y, 0);
      if (this.vectors.length > 10 && v.dist(this.vectors[0]) < 20) {
        // 頭とおしりがくっつくときに閉じるみたいですね
        // 短すぎると登録できないようです（すぐに閉じるのを防ぐ）
        this.closed = true;
        // 閉じたときに色を決める
        const col = fisceToyBox.hsv2rgb(Math.random(), 1, 1);
        this.shapeColor = color(col.r*255, col.g*255, col.b*255);
      } else if (this.vectors.length > 0 && v.dist(this.vectors[this.vectors.length - 1]) > 10) {
        // 前の点からある程度離れているときに追加するみたい
        // 10は長すぎる気もするけど
        this.vectors.push(v);
      }
    }
  }
  
  drawGuide(gr){
    if(this.completed){ return; }
    gr.push();
    // 設置样式
    gr.strokeWeight(4);
    gr.stroke(this.shapeColor);
    gr.fill(this.shapeColor);
    // 绘制起点圆圈
    gr.circle(this.vectors[0].x, this.vectors[0].y, 10);
    
    // 添加一些辅助信息，显示形状进度
    if (this.vectors.length > 2) {
      gr.noStroke();
      gr.fill(0);
      gr.textAlign(LEFT, BOTTOM);
      gr.textSize(12);
      let lastVertex = this.vectors[this.vectors.length - 1];
      gr.text(this.vectors.length + " points", lastVertex.x + 15, lastVertex.y - 5);
      // 如果接近能闭合的状态，显示提示
      if (this.vectors.length > 10) {
        let dist = p5.Vector.dist(
          createVector(this.vectors[0].x, this.vectors[0].y),
          createVector(lastVertex.x, lastVertex.y)
        );
        if (dist < 40) {
          gr.textAlign(CENTER, TOP);
          gr.text("Close to complete!", (this.vectors[0].x + lastVertex.x)/2, 
                 (this.vectors[0].y + lastVertex.y)/2 + 15);
        }
      }
    }
    
    // 绘制路径
    gr.noFill();
    gr.stroke(this.shapeColor);
    gr.beginShape();
    for (let i = 0; i < this.vectors.length; i++) {
      gr.vertex(this.vectors[i].x, this.vectors[i].y);
    }
    
    if(this.closed) {
      gr.endShape(CLOSE);
    } else {
      gr.endShape();
      
      // 如果还没闭合，绘制当前点（跟随鼠标的圆点）
      gr.fill(this.shapeColor);
      gr.circle(
        this.vectors[this.vectors.length - 1].x,
        this.vectors[this.vectors.length - 1].y,
        10
      );
      
      // 绘制一个半透明的圆在起点，提示用户可以闭合
      if (this.vectors.length > 10) {
        // 计算到起点的距离
        let dist = p5.Vector.dist(
          createVector(this.vectors[0].x, this.vectors[0].y),
          createVector(this.vectors[this.vectors.length - 1].x, this.vectors[this.vectors.length - 1].y)
        );
        // 如果接近起点，起点圆圈会变大，表示可以闭合
        if (dist < 40) {
          gr.fill(this.shapeColor._getRed(), this.shapeColor._getGreen(), 
                 this.shapeColor._getBlue(), 120);
          gr.circle(this.vectors[0].x, this.vectors[0].y, 20 + (40-dist)/2);
        } else {
          gr.fill(this.shapeColor._getRed(), this.shapeColor._getGreen(), 
                 this.shapeColor._getBlue(), 100);
          gr.circle(this.vectors[0].x, this.vectors[0].y, 20);
        }
      }
    }
    gr.pop();
  }
  
  complete(){
    this.active = false;
    if(this.closed){
      // shapeのgeometryを構成する
      this.createShape();
      this.completed = true;
    }else{
      // closedでないのにcomplete処理が行われたら排除
      this.kill();
    }
  }
  
  createShape(){
    // 找到绘制多边形的重心，同时将顶点移到局部坐标系
    this.position = findCenter(this.vectors);
    
    // 计算形状的近似大小（用于碰撞检测）
    let size = 0;
    for (let v of this.vectors) {
      size = max(size, v.mag());
    }
    size *= this.scale * 1.5; // 加上一些边距
    
    // 寻找合适的位置
    this.findVisiblePosition(size);
    
    // 创建唯一ID并生成3D几何体
    this.gId = `shape3D${geomId}`;
    geomId++;
    
    // 调用createShape3D创建3D几何体
    createShape3D.call(this.renderer, this.gId, this.vectors);
    
    // 将位置和大小记录到全局列表，用于后续碰撞检测
    shapesPositions.push({
      pos: this.position.copy(),
      size: size
    });
  }
  
  // 在3D空间中寻找合适位置的方法（总是在相机前方，但不跟随旋转）
  findVisiblePosition(size) {
    // 获取相机的朝向向量（当前视线方向）
    let camDirection = createVector(
      -cos(pitch) * sin(yaw),  // X方向
      sin(pitch),              // Y方向
      -cos(pitch) * cos(yaw)   // Z方向
    );
    
    // 相机右侧向量
    let camRight = createVector(cos(yaw), 0, -sin(yaw));
    // 相机上方向量（固定为世界坐标系上方向，不随相机旋转）
    let camUp = createVector(0, 1, 0);
    
    // 距离范围 - 控制形状出现在相机前方的距离
    const minDistance = 300;
    const maxDistance = 1000;
    let distance = random(minDistance, maxDistance);
    
    // 计算形状的基础位置（直接在相机正前方）
    let basePos = p5.Vector.add(
      camPos,
      p5.Vector.mult(camDirection, distance)
    );
    
    // 增加一些水平和垂直的随机偏移，但确保仍然在视野内
    const horizontalSpread = distance * 0.6; // 水平扩散范围（随距离增加）
    const verticalSpread = distance * 0.4;   // 垂直扩散范围（随距离增加）
    
    // 添加随机偏移
    let offsetRight = random(-horizontalSpread, horizontalSpread);
    let offsetUp = random(-verticalSpread/2, verticalSpread/2); // 减少垂直偏移，使图形更集中
    
    // 计算最终位置，加入随机偏移
    let finalPos = p5.Vector.add(
      basePos,
      p5.Vector.add(
        p5.Vector.mult(camRight, offsetRight),
        p5.Vector.mult(camUp, offsetUp)
      )
    );
    
    // 根据平面类型调整位置
    switch(this.planeType) {
      case 0: // XZ平面（地面）
        // 对于地面，我们固定Y坐标为0（放置在地面上）
        finalPos.y = 0; 
        break;
      case 1: // XY平面（垂直面，垂直于Z轴）
        // 可以根据需要调整Z轴位置，使其更明显是XY平面
        // 例如，可以稍微偏移Z轴位置以避免与其他物体重叠
        break;
      case 2: // ZY平面（垂直面，垂直于X轴）
        // 可以根据需要调整X轴位置，使其更明显是ZY平面
        // 例如，可以稍微偏移X轴位置以避免与其他物体重叠
        break;
    }
    
    // 检查是否与现有形状重叠
    let isOverlapping = false;
    for (let shape of shapesPositions) {
      let distance = p5.Vector.dist(finalPos, shape.pos);
      if (distance < (size + shape.size + MIN_SHAPE_DISTANCE)) {
        isOverlapping = true;
        break;
      }
    }
    
    // 如果不重叠或者是第一个形状，使用此位置
    if (!isOverlapping || shapesPositions.length === 0) {
      this.position = finalPos;
      this.hasValidPosition = true;
      return;
    }
    
    // 如果发生重叠，尝试多次调整位置
    let attempts = 1;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts && isOverlapping) {
      // 增加随机偏移的范围
      offsetRight = random(-horizontalSpread * 1.5, horizontalSpread * 1.5);
      offsetUp = random(-verticalSpread/2, verticalSpread/2);
      // 稍微调整距离
      distance = random(minDistance, maxDistance);
      
      // 重新计算位置
      basePos = p5.Vector.add(
        camPos,
        p5.Vector.mult(camDirection, distance)
      );
      
      finalPos = p5.Vector.add(
        basePos,
        p5.Vector.add(
          p5.Vector.mult(camRight, offsetRight),
          p5.Vector.mult(camUp, offsetUp)
        )
      );
      
      // 根据平面类型调整
      if (this.planeType === 0) finalPos.y = 0; // 固定在地面上
      
      // 重新检查重叠
      isOverlapping = false;
      for (let shape of shapesPositions) {
        let distance = p5.Vector.dist(finalPos, shape.pos);
        if (distance < (size + shape.size + MIN_SHAPE_DISTANCE)) {
          isOverlapping = true;
          break;
        }
      }
      
      attempts++;
    }
    
    // 即使尝试多次仍然重叠，也使用最后计算的位置
    this.position = finalPos;
    this.hasValidPosition = true;
  }
  
  display() {
    if (!this.completed || !this.hasValidPosition) return;
    
    push();
    ambientMaterial(this.shapeColor);
    translate(this.position);
    
    // 根据不同平面类型应用固定的旋转，不会随相机变化
    switch(this.planeType) {
      case 0: // XZ平面（地面）
        // 绕X轴旋转90度，使形状平放在地面上
        rotateX(-PI/2);
        break;
      case 1: // XY平面（垂直面）
        // 对于XY平面，形状应该垂直面向Z轴方向
        // 不需要额外旋转，因为默认就是XY平面
        break;
      case 2: // ZY平面（垂直面）
        // 垂直于X轴的面，形状应该面向X轴方向
        rotateY(PI/2); // 绕Y轴旋转90度
        break;
    }
    
    // 应用缩放
    scale(this.scale);
    
    try {
      // 绘制缓冲的3D几何体
      this.renderer.drawBuffers(this.gId);
    } catch (error) {
      console.error(`Error drawing shape ${this.gId}:`, error);
    }
    
    pop();
  }
  
  remove(){
    if(!this.alive){
      // 在全局位置数组中查找并移除该形状的位置信息
      if (this.hasValidPosition) {
        const index = shapesPositions.findIndex(shape => 
          shape.pos.x === this.position.x && 
          shape.pos.y === this.position.y && 
          shape.pos.z === this.position.z
        );
        if (index !== -1) {
          shapesPositions.splice(index, 1);
        }
      }
      // crossReferenceArrayを使って排除する
      // 閉じずに開いた場合もこれでkillすればいいわね
      shapes.remove(this);
    }
  }
}

// --------------------------------------------------------------- //
// utility.

// CrossReferenceArray.
class CrossReferenceArray extends Array{
  constructor(){
    super();
  }
  add(element){
    this.push(element);
    element.belongingArray = this; // 所属配列への参照
  }
  addMulti(elementArray){
    // 複数の場合
    elementArray.forEach((element) => { this.add(element); })
  }
  remove(element){
    let index = this.indexOf(element, 0);
    this.splice(index, 1); // elementを配列から排除する
  }
  loop(methodName, args = []){
    if(this.length === 0){ return; }
    // methodNameには"update"とか"display"が入る。まとめて行う処理。
    for(let i = 0; i < this.length; i++){
      this[i][methodName](...args);
    }
  }
  loopReverse(methodName, args = []){
    if(this.length === 0){ return; }
    // 逆から行う。排除とかこうしないとエラーになる。もうこりごり。
    for(let i = this.length - 1; i >= 0; i--){
      this[i][methodName](...args);
    }
  }
  clear(){
    this.length = 0;
  }
}

// --------------------------------------------------------------- //
// 添加白色雕塑相关代码

// Hash函数，用于生成唯一标识
function hash(i, j, k) {
  return (((i + 1000) * 1000) + j + 1000) * 1000 + k + 1000;
}

// 方向和立方体相关常量
const directions = [[0, 0, 1], [0, 0, -1],
[1, 0, 0], [-1, 0, 0],
[0, -1, 0]];
const cubeVtx = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const cubeFac = [[3, 2, 1, 0], [4, 5, 6, 7],
[2, 6, 5, 1], [0, 4, 7, 3],
[0, 1, 5, 4], [2, 3, 7, 6]];
const cubeFacNeigh = [[0, 0, -1], [0, 0, 1],
[1, 0, 0], [-1, 0, 0],
[0, -1, 0], [0, 1, 0]];
const vtxCubeNeigh = [[0, 0, 0], [0, 0, -1], [0, -1, 0], [0, -1, -1],
[-1, 0, 0], [-1, 0, -1], [-1, -1, 0], [-1, -1, -1]];

// BlockObject类 - 用于生成白色雕塑的块状结构
class BlockObject {
  constructor(n, seed = [0, 0, 0], prob = 0.9) {
    let occupied = new Set();
    let blocks = [seed];
    let border = [...blocks];
    occupied.add(hash(...seed));
    Object.assign(this, {occupied, blocks, border, prob});
    while (n > 1 && border.length > 0) {
      if (this.addBlock()) n--;
    }
  }
  addBlock() {
    let {occupied, blocks, border, prob} = this;
    shuffle(border, true);
    let [i, j, k] = border[border.length - 1];
    let found = false;
    let block;
    for (let [di, dj, dk] of shuffle(directions)) {
      block = [i + di, j + dj, k + dk];
      let h = hash(...block);
      if (!occupied.has(h)) {
        occupied.add(h);
        found = true;
        break;
      }
    }
    if (found) {
      if (random() < prob) border.pop();
      border.push(block);
      blocks.push(block);
      this._mesh = null;
      this._radius = null;
    } else border.pop();
    return found;
  }
  get radius() {
    if (!this._radius) {
      let r = 0;
      for (let [i, j, k] of this.blocks) {
        let d = Math.hypot(i, j, k);
        if (d > r) r = d;
      }
      this._radius = r + sqrt(3) / 2;
    }
    return this._radius;
  }
  get mesh() {
    if (!this._mesh) {
      let {occupied, blocks} = this;
      const reuseVertex = (vi, vj, vk) => {
        let cubeNeigh = [];
        for (let [di, dj, dk] of vtxCubeNeigh) {
          let [i, j, k] = [vi + di, vj + dj, vk + dk];
          if (occupied.has(hash(i, j, k))) {
            cubeNeigh.push([i, j, k]);
          }
        }
        if (cubeNeigh.length != 2) return true;
        let eqDim = 0;
        let [cube1, cube2] = cubeNeigh;
        for (let d of [0, 1, 2]) if (cube1[d] == cube2[d]) eqDim++;
        return eqDim != 1;
      };
      let vset = new Map();
      let positions = [];
      let faces = [];
      let faceBlock = [];
      for (let iblock = 0; iblock < blocks.length; iblock++) {
        let [i, j, k] = blocks[iblock];
        for (let ifac = 0; ifac < 6; ifac++) {
          let [ni, nj, nk] = cubeFacNeigh[ifac];
          let hneigh = hash(i + ni, j + nj, k + nk);
          if (occupied.has(hneigh)) continue;
          let fac = cubeFac[ifac];
          let circ = [];
          for (let ivtx of fac) {
            let [vx, vy, vz] = cubeVtx[ivtx];
            let pos = [i + vx, j + vy, k + vz];
            let hpos = hash(...pos);
            let ipos;
            if (vset.has(hpos)) {
              let vobj = vset.get(hpos);
              if (!vobj.reuse && iblock != vobj.iblock) {
                if (!vobj.ipos2) {
                  vobj.ipos2 = positions.length;
                  positions.push(pos);
                }
                ipos = vobj.ipos2;
              } else ipos = vobj.ipos;
            } else {
              ipos = positions.length;
              let reuse = reuseVertex(...pos);
              positions.push(pos);
              vset.set(hpos, {ipos, reuse, iblock});
            }
            circ.push(ipos);
          }
          faceBlock.push(iblock);
          faces.push(circ);
        }
      }
      // 确保有正确的Mesh类
      if (typeof makeManifold === 'function') {
        makeManifold(positions, faces, faceBlock);
      }
      if (typeof Mesh !== 'undefined') {
        this._mesh = new Mesh(positions, faces);
      } else {
        // 如果没有Mesh类，创建p5.Geometry
        const geom = new p5.Geometry();
        for (let pos of positions) {
          geom.vertices.push(new p5.Vector(pos[0], pos[1], pos[2]));
        }
        for (let face of faces) {
          if (face.length === 3) {
            geom.faces.push(face);
          } else if (face.length === 4) {
            // 四边形分解为两个三角形
            geom.faces.push([face[0], face[1], face[2]]);
            geom.faces.push([face[0], face[2], face[3]]);
          }
        }
        geom.computeNormals();
        this._mesh = { p5Geometry: geom };
      }
    }
    return this._mesh;
  }
}

// makeManifold函数 - 处理网格以确保流形性
function makeManifold(positions, faces, faceBlock) {
  let heMap = new Map();
  let nfac = faces.length;
  let dupHe = [];
  for (let ifac = 0; ifac < nfac; ifac++) {
    let face = faces[ifac];
    let n = face.length;
    for (let iedge = 0; iedge < n; iedge++) {
      let iedgePrev = (iedge - 1 + n) % n;
      let v0 = face[iedgePrev];
      let v1 = face[iedge];
      let opp = v0 > v1;
      if (opp) {
        [v0, v1] = [v1, v0];
      }
      let h = hash(0, v0, v1);
      if (heMap.has(h)) {
        let he = heMap.get(h);
        he.edgeFaces.push({ifac, iedge, iedgePrev, faceBlock: faceBlock[ifac], opp});
        if (he.edgeFaces.length == 3) dupHe.push(he);
      } else {
        let he = {edgeFaces: [{ifac, iedge, iedgePrev, faceBlock: faceBlock[ifac], opp}], v0, v1};
        heMap.set(h, he);
      }
    }
  }
  if (dupHe.length > 0) {
    for (let {edgeFaces, v0, v1} of dupHe) {
      let newVtx = new Map();
      let [a, b] = [positions[v0], positions[v1]];
      let pos = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      for (let {ifac, opp, faceBlock} of edgeFaces) {
        let vtx;
        if (newVtx.has(faceBlock)) {
          vtx = newVtx.get(faceBlock);
        } else {
          vtx = positions.length;
          newVtx.set(faceBlock, vtx);
          positions.push(pos);
        }
        let face = faces[ifac];
        let iedge;
        if (opp) iedge = face.indexOf(v0);
        else iedge = face.indexOf(v1);
        faces[ifac].splice(iedge, 0, vtx);
      }
    }
  }
}
