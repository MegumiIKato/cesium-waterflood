/**
 * 绘图工具模块
 * 提供矩形绘制功能
 */

// 绘图状态
let drawState = {
    // 是否正在绘制
    isDrawing: false,
    // 起始点
    startPosition: null,
    // 结束点
    endPosition: null,
    // 矩形实体
    rectangleEntity: null,
    // 事件处理器
    handler: null
};

/**
 * 初始化矩形绘制工具
 * @param {Cesium.Viewer} viewer - Cesium查看器实例
 * @returns {Object} 绘图控制对象
 */
export function initDrawTools(viewer) {
    // 创建事件处理器
    drawState.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // 返回控制对象
    return {
        startDrawRectangle: () => startDrawRectangle(viewer),
        stopDrawRectangle: () => stopDrawRectangle(viewer)
    };
}

/**
 * 开始绘制矩形
 * @param {Cesium.Viewer} viewer - Cesium查看器实例
 */
export function startDrawRectangle(viewer) {
    // 如果已经在绘制中，则先停止
    if (drawState.isDrawing) {
        stopDrawRectangle(viewer);
    }
    
    // 设置绘制状态
    drawState.isDrawing = true;
    drawState.startPosition = null;
    drawState.endPosition = null;
    
    // 移除之前的矩形实体
    if (drawState.rectangleEntity) {
        viewer.entities.remove(drawState.rectangleEntity);
        drawState.rectangleEntity = null;
    }
    
    // 确保事件处理器存在
    if (!drawState.handler) {
        drawState.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    }
    
    // 清除所有现有的事件处理
    drawState.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    drawState.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    // 设置鼠标左键点击事件处理
    drawState.handler.setInputAction(function(click) {
        // 获取点击位置的地理坐标
        let cartesian = viewer.scene.pickPosition(click.position);
        
        // 如果没有获取到坐标，则尝试使用椭球体表面的坐标
        if (!cartesian) {
            const ray = viewer.camera.getPickRay(click.position);
            if (ray) {
                cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                if (!cartesian) {
                    // 如果仍然没有获取到坐标，尝试使用椭球体
                    cartesian = viewer.camera.pickEllipsoid(
                        click.position,
                        viewer.scene.globe.ellipsoid
                    );
                    if (!cartesian) {
                        return; // 如果仍然没有获取到坐标，则退出
                    }
                }
            } else {
                return; // 如果无法创建射线，则退出
            }
        }
        
        // 如果是第一次点击，记录起始点
        if (!drawState.startPosition) {
            drawState.startPosition = cartesian;
            
            // 创建临时矩形实体
            drawState.rectangleEntity = viewer.entities.add({
                name: 'DrawingRectangle',
                rectangle: {
                    coordinates: new Cesium.CallbackProperty(function() {
                        if (!drawState.startPosition || !drawState.endPosition) {
                            return Cesium.Rectangle.fromDegrees(0, 0, 0, 0);
                        }
                        
                        // 将笛卡尔坐标转换为地理坐标
                        const startCartographic = Cesium.Cartographic.fromCartesian(drawState.startPosition);
                        const endCartographic = Cesium.Cartographic.fromCartesian(drawState.endPosition);
                        
                        // 创建矩形
                        return Cesium.Rectangle.fromRadians(
                            Math.min(startCartographic.longitude, endCartographic.longitude),
                            Math.min(startCartographic.latitude, endCartographic.latitude),
                            Math.max(startCartographic.longitude, endCartographic.longitude),
                            Math.max(startCartographic.latitude, endCartographic.latitude)
                        );
                    }, false),
                    material: Cesium.Color.BLUE.withAlpha(0.5),
                    outline: true,
                    outlineColor: Cesium.Color.WHITE
                }
            });
            
            // 设置鼠标移动事件处理
            drawState.handler.setInputAction(function(movement) {
                // 获取鼠标移动位置的地理坐标
                let cartesian = viewer.scene.pickPosition(movement.endPosition);
                
                // 如果没有获取到坐标，则尝试使用椭球体表面的坐标
                if (!cartesian) {
                    const ray = viewer.camera.getPickRay(movement.endPosition);
                    if (ray) {
                        cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                        if (!cartesian) {
                            // 如果仍然没有获取到坐标，尝试使用椭球体
                            cartesian = viewer.camera.pickEllipsoid(
                                movement.endPosition,
                                viewer.scene.globe.ellipsoid
                            );
                            if (!cartesian) {
                                return; // 如果仍然没有获取到坐标，则退出
                            }
                        }
                    } else {
                        return; // 如果无法创建射线，则退出
                    }
                }
                
                // 更新结束点
                drawState.endPosition = cartesian;
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        } else {
            // 如果是第二次点击，完成绘制
            drawState.endPosition = cartesian;
            
            // 输出矩形范围数据
            outputRectangleData(drawState.startPosition, drawState.endPosition);
            
            // 停止绘制
            stopDrawRectangle(viewer);
            
            // 更新按钮文本
            const drawRectangleBtn = document.getElementById('DrawRectangle');
            if (drawRectangleBtn) {
                drawRectangleBtn.textContent = '开始绘制';
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    console.log('开始绘制矩形，请点击地图上的两个点来确定矩形的对角线');
}

/**
 * 停止绘制矩形
 * @param {Cesium.Viewer} viewer - Cesium查看器实例
 */
export function stopDrawRectangle(viewer) {
    // 确保事件处理器存在
    if (drawState.handler) {
        // 移除事件处理
        drawState.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        drawState.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }
    
    // 设置绘制状态
    drawState.isDrawing = false;
    
    console.log('停止绘制矩形');
}

/**
 * 输出矩形范围数据
 * @param {Cesium.Cartesian3} startPosition - 起始点
 * @param {Cesium.Cartesian3} endPosition - 结束点
 */
function outputRectangleData(startPosition, endPosition) {
    if (!startPosition || !endPosition) {
        console.warn('无法输出矩形范围数据：起始点或结束点未定义');
        return;
    }
    
    // 将笛卡尔坐标转换为地理坐标
    const startCartographic = Cesium.Cartographic.fromCartesian(startPosition);
    const endCartographic = Cesium.Cartographic.fromCartesian(endPosition);
    
    // 计算矩形范围
    const west = Math.min(startCartographic.longitude, endCartographic.longitude);
    const south = Math.min(startCartographic.latitude, endCartographic.latitude);
    const east = Math.max(startCartographic.longitude, endCartographic.longitude);
    const north = Math.max(startCartographic.latitude, endCartographic.latitude);
    
    // 转换为度数
    const westDegrees = Cesium.Math.toDegrees(west);
    const southDegrees = Cesium.Math.toDegrees(south);
    const eastDegrees = Cesium.Math.toDegrees(east);
    const northDegrees = Cesium.Math.toDegrees(north);
    
    // 输出矩形范围数据
    console.log('矩形范围数据（弧度）:', {
        west: west,
        south: south,
        east: east,
        north: north
    });
    
    console.log('矩形范围数据（度）:', {
        west: westDegrees,
        south: southDegrees,
        east: eastDegrees,
        north: northDegrees
    });
    
    // 计算矩形中心点
    const centerLongitude = (west + east) / 2;
    const centerLatitude = (south + north) / 2;
    
    console.log('矩形中心点（度）:', {
        longitude: Cesium.Math.toDegrees(centerLongitude),
        latitude: Cesium.Math.toDegrees(centerLatitude)
    });
    
    // 计算矩形宽度和高度（近似值，单位：米）
    const width = Cesium.Cartesian3.distance(
        Cesium.Cartesian3.fromRadians(west, centerLatitude),
        Cesium.Cartesian3.fromRadians(east, centerLatitude)
    );
    
    const height = Cesium.Cartesian3.distance(
        Cesium.Cartesian3.fromRadians(centerLongitude, south),
        Cesium.Cartesian3.fromRadians(centerLongitude, north)
    );
    
    console.log('矩形尺寸（米）:', {
        width: width,
        height: height,
        area: width * height
    });
} 