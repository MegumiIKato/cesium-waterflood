let isAdjusting = false;
let selectedTileset = null;
let originalMatrix = null;
let currentOffset = { x: 0, y: 0, z: 0 };
let moveSpeed = 0.1; // 移动速度
let moveStep = 0.1; // 移动步长

export function initModelAdjuster(viewer, tileset) {
    selectedTileset = tileset;
    originalMatrix = tileset.modelMatrix.clone();
    
    // 创建调整控制面板
    const controlPanel = document.createElement('div');
    controlPanel.style.position = 'absolute';
    controlPanel.style.top = '10px';
    controlPanel.style.right = '10px';
    controlPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    controlPanel.style.padding = '10px';
    controlPanel.style.borderRadius = '5px';
    
    // 创建调整按钮
    const adjustButton = document.createElement('button');
    adjustButton.textContent = '调整模型位置';
    adjustButton.style.marginBottom = '5px';
    controlPanel.appendChild(adjustButton);
    
    // 创建重置按钮
    const resetButton = document.createElement('button');
    resetButton.textContent = '重置位置';
    controlPanel.appendChild(resetButton);
    
    // 创建速度控制
    const speedControl = document.createElement('div');
    speedControl.style.marginTop = '5px';
    speedControl.innerHTML = `
        <div>移动速度: <input type="range" min="0.01" max="1" step="0.01" value="0.1"></div>
        <div>移动步长: <input type="range" min="0.01" max="1" step="0.01" value="0.1"></div>
    `;
    controlPanel.appendChild(speedControl);
    
    // 创建说明文本
    const instructions = document.createElement('div');
    instructions.style.marginTop = '5px';
    instructions.style.fontSize = '12px';
    instructions.innerHTML = `
        控制说明：<br>
        W/S: 前后移动<br>
        A/D: 左右移动<br>
        Q/E: 上下移动<br>
        调整完成后点击"完成调整"
    `;
    controlPanel.appendChild(instructions);
    
    // 创建偏移量显示
    const offsetDisplay = document.createElement('div');
    offsetDisplay.style.marginTop = '5px';
    offsetDisplay.style.fontSize = '12px';
    controlPanel.appendChild(offsetDisplay);
    
    viewer.container.appendChild(controlPanel);
    
    // 速度控制事件
    const speedInput = speedControl.querySelector('input[type="range"]:first-child');
    const stepInput = speedControl.querySelector('input[type="range"]:last-child');
    
    speedInput.addEventListener('input', function(e) {
        moveSpeed = parseFloat(e.target.value);
    });
    
    stepInput.addEventListener('input', function(e) {
        moveStep = parseFloat(e.target.value);
    });
    
    // 更新偏移量显示
    function updateOffsetDisplay() {
        offsetDisplay.innerHTML = `
            X: ${currentOffset.x.toFixed(2)}m<br>
            Y: ${currentOffset.y.toFixed(2)}m<br>
            Z: ${currentOffset.z.toFixed(2)}m
        `;
    }
    
    // 键盘控制函数
    function handleKeyDown(event) {
        if (!isAdjusting) return;
        
        const camera = viewer.camera;
        const direction = camera.direction;
        const right = camera.right;
        const up = Cesium.Cartesian3.cross(direction, right, new Cesium.Cartesian3());
        
        let moveVector = new Cesium.Cartesian3();
        
        switch(event.key.toLowerCase()) {
            case 'w':
                Cesium.Cartesian3.multiplyByScalar(direction, moveStep * moveSpeed, moveVector);
                break;
            case 's':
                Cesium.Cartesian3.multiplyByScalar(direction, -moveStep * moveSpeed, moveVector);
                break;
            case 'a':
                Cesium.Cartesian3.multiplyByScalar(right, -moveStep * moveSpeed, moveVector);
                break;
            case 'd':
                Cesium.Cartesian3.multiplyByScalar(right, moveStep * moveSpeed, moveVector);
                break;
            case 'q':
                Cesium.Cartesian3.multiplyByScalar(up, moveStep * moveSpeed, moveVector);
                break;
            case 'e':
                Cesium.Cartesian3.multiplyByScalar(up, -moveStep * moveSpeed, moveVector);
                break;
            default:
                return;
        }
        
        // 更新偏移量
        currentOffset.x += moveVector.x;
        currentOffset.y += moveVector.y;
        currentOffset.z += moveVector.z;
        
        // 更新模型矩阵
        const translation = new Cesium.Cartesian3(
            currentOffset.x,
            currentOffset.y,
            currentOffset.z
        );
        const newMatrix = Cesium.Matrix4.fromTranslation(translation);
        selectedTileset.modelMatrix = newMatrix;
        
        updateOffsetDisplay();
    }
    
    // 调整按钮点击事件
    adjustButton.addEventListener('click', function() {
        isAdjusting = !isAdjusting;
        adjustButton.textContent = isAdjusting ? '完成调整' : '调整模型位置';
        
        if (isAdjusting) {
            // 启用键盘控制
            window.addEventListener('keydown', handleKeyDown);
        } else {
            // 禁用键盘控制
            window.removeEventListener('keydown', handleKeyDown);
        }
    });
    
    // 重置按钮点击事件
    resetButton.addEventListener('click', function() {
        currentOffset = { x: 0, y: 0, z: 0 };
        selectedTileset.modelMatrix = originalMatrix.clone();
        updateOffsetDisplay();
    });
    
    // 初始化显示
    updateOffsetDisplay();
} 