// 定义深度分级颜色
const depthColorMap = {
    "大于0.5米": Cesium.Color.GREEN.withAlpha(0.7),
    "0.5-0米": Cesium.Color.YELLOW.withAlpha(0.7),
    "已溢出": Cesium.Color.RED.withAlpha(0.7)
};

// 定义统一点尺寸
const pointSize = 6;

// 默认蓝色
const defaultColor = Cesium.Color.BLUE.withAlpha(0.7);

// 缓冲区颜色
const bufferColor = new Cesium.Color(0.5, 0.8, 0.9)

// 存储所有点实体的数组，以便后续更新
let pointEntities = [];
// 存储连接区域的实体
let connectionEntities = [];

// 清除连接区域
function clearConnections(viewer) {
    connectionEntities.forEach(entity => {
        viewer.entities.remove(entity);
    });
    connectionEntities = [];
}

// 计算两点之间的距离
function calculateDistance(pos1, pos2) {
    return Cesium.Cartesian3.distance(pos1, pos2);
}

// 创建连接区域
function createConnections(viewer, bufferPoints) {
    clearConnections(viewer);
    const maxDistance = 25; // 连接距离

    // 第一步：找出所有点对及其距离
    let pointPairs = [];
    for (let i = 0; i < bufferPoints.length; i++) {
        for (let j = i + 1; j < bufferPoints.length; j++) {
            const distance = calculateDistance(
                bufferPoints[i].position,
                bufferPoints[j].position
            );
            const combinedRadius = bufferPoints[i].radius + bufferPoints[j].radius;
            if (distance <= maxDistance + combinedRadius) {
                pointPairs.push({
                    point1: i,
                    point2: j,
                    distance: distance
                });
            }
        }
    }

    // 按距离排序
    pointPairs.sort((a, b) => a.distance - b.distance);

    // 使用并查集管理分组
    let pointGroups = new Array(bufferPoints.length).fill(0).map((_, i) => i);
    
    function findGroup(point) {
        if (pointGroups[point] !== point) {
            pointGroups[point] = findGroup(pointGroups[point]);
        }
        return pointGroups[point];
    }
    
    function unionGroups(point1, point2) {
        const group1 = findGroup(point1);
        const group2 = findGroup(point2);
        if (group1 !== group2) {
            pointGroups[group2] = group1;
        }
    }

    // 连接点
    pointPairs.forEach(pair => {
        unionGroups(pair.point1, pair.point2);
    });

    // 整理分组
    let groups = new Map();
    for (let i = 0; i < bufferPoints.length; i++) {
        const groupId = findGroup(i);
        if (!groups.has(groupId)) {
            groups.set(groupId, []);
        }
        groups.get(groupId).push(i);
    }

    // 为每个组创建融合区域
    groups.forEach(group => {
        if (group.length === 1) {
            // 单个点处理
            const point = bufferPoints[group[0]];
            const cart = Cesium.Cartographic.fromCartesian(point.position);
            const positions = [];
            const segments = 128;

            for (let k = 0; k <= segments; k++) {
                const angle = (k / segments) * Math.PI * 2;
                const dx = Math.cos(angle) * point.radius;
                const dy = Math.sin(angle) * point.radius;
                const pos = Cesium.Cartesian3.fromDegrees(
                    Cesium.Math.toDegrees(cart.longitude) + dx / 111000,
                    Cesium.Math.toDegrees(cart.latitude) + dy / 111000,
                    point.height + 2.0
                );
                positions.push(pos);
            }

            const entity = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(positions),
                    material: bufferColor,
                    height: point.height + 2.0,
                    outline: false,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            connectionEntities.push(entity);
        } else {
            // 多点融合处理
            const avgHeight = group.reduce((sum, index) => sum + bufferPoints[index].height, 0) / group.length;
            
            // 创建外轮廓点
            let outlinePoints = [];
            group.forEach(pointIndex => {
                const point = bufferPoints[pointIndex];
                const cart = Cesium.Cartographic.fromCartesian(point.position);
                const segments = 64;
                
                for (let k = 0; k < segments; k++) {
                    const angle = (k / segments) * Math.PI * 2;
                    let radius = point.radius;
                    
                    // 检查这个方向是否有其他点
                    group.forEach(otherIndex => {
                        if (otherIndex !== pointIndex) {
                            const otherPoint = bufferPoints[otherIndex];
                            const otherCart = Cesium.Cartographic.fromCartesian(otherPoint.position);
                            const directionToOther = Math.atan2(
                                Cesium.Math.toDegrees(otherCart.latitude) - Cesium.Math.toDegrees(cart.latitude),
                                Cesium.Math.toDegrees(otherCart.longitude) - Cesium.Math.toDegrees(cart.longitude)
                            );
                            
                            const angleDiff = Math.abs(angle - directionToOther);
                            if (angleDiff < Math.PI / 3 || angleDiff > Math.PI * 5/3) {
                                const distance = calculateDistance(point.position, otherPoint.position);
                                const blendFactor = Math.max(0, 1 - distance / (maxDistance + point.radius + otherPoint.radius));
                                radius *= (1 + blendFactor * 0.5);
                            }
                        }
                    });

                    const dx = Math.cos(angle) * radius;
                    const dy = Math.sin(angle) * radius;
                    outlinePoints.push(Cesium.Cartesian3.fromDegrees(
                        Cesium.Math.toDegrees(cart.longitude) + dx / 111000,
                        Cesium.Math.toDegrees(cart.latitude) + dy / 111000,
                        avgHeight + 2.0
                    ));
                }
            });

            // 使用凸包算法获取外轮廓
            const positions = getConvexHull(outlinePoints);

            // 创建平滑的多边形
            const entity = viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(positions),
                    material: bufferColor,
                    height: avgHeight + 2.0,
                    outline: false,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            connectionEntities.push(entity);
        }
    });
}

// 计算凸包的辅助函数
function getConvexHull(points) {
    // Graham扫描法计算凸包
    function orientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0;
        return (val > 0) ? 1 : 2;
    }

    // 转换Cartesian3到简单的x,y坐标
    const simplePoints = points.map(p => {
        const cart = Cesium.Cartographic.fromCartesian(p);
        return {
            x: Cesium.Math.toDegrees(cart.longitude),
            y: Cesium.Math.toDegrees(cart.latitude),
            original: p
        };
    });

    // 找到最下方的点
    let bottomPoint = simplePoints[0];
    for (let i = 1; i < simplePoints.length; i++) {
        if (simplePoints[i].y < bottomPoint.y || 
            (simplePoints[i].y === bottomPoint.y && simplePoints[i].x < bottomPoint.x)) {
            bottomPoint = simplePoints[i];
        }
    }

    // 按极角排序
    simplePoints.sort((a, b) => {
        const o = orientation(bottomPoint, a, b);
        if (o === 0) {
            return (bottomPoint.x - a.x) * (bottomPoint.x - a.x) + 
                   (bottomPoint.y - a.y) * (bottomPoint.y - a.y) -
                   ((bottomPoint.x - b.x) * (bottomPoint.x - b.x) + 
                    (bottomPoint.y - b.y) * (bottomPoint.y - b.y));
        }
        return (o === 2) ? -1 : 1;
    });

    // 构建凸包
    const stack = [simplePoints[0], simplePoints[1], simplePoints[2]];
    for (let i = 3; i < simplePoints.length; i++) {
        while (stack.length > 1 && orientation(stack[stack.length - 2], 
               stack[stack.length - 1], simplePoints[i]) !== 2) {
            stack.pop();
        }
        stack.push(simplePoints[i]);
    }

    // 返回原始Cartesian3点
    return stack.map(p => p.original);
}

// 创建点缓冲区
export function createPointBuffer(viewer, pointEntities) {
    // 清除现有的缓冲区
    pointEntities.forEach(item => {
        if (item.bufferEntity) {
            viewer.entities.remove(item.bufferEntity);
        }
    });
    
    // 清除现有的连接区域
    clearConnections(viewer);

    // 存储有缓冲区的点信息
    const bufferPoints = [];

    // 为每个点创建缓冲区
    pointEntities.forEach(item => {
        const position = item.entity.position.getValue();
        const properties = item.entity.properties.getValue();
        
        // 只处理有FLOOD_VOLUME数据的点
        if (properties.FLOOD_VOLUME !== undefined && properties.FLOOD_VOLUME !== null) {
            // 计算缓冲区半径
            const floodVolume = properties.FLOOD_VOLUME * 1000000; // 升，乘以10^6
            const avgDepth = properties.MAX_DEPTH; // 米
            const volumeM3 = floodVolume / 1000; // 转换为立方米
            const area = volumeM3 / avgDepth; // 计算面积
            const radius = Math.sqrt(area / Math.PI); // 计算半径

            const bufferEntity = viewer.entities.add({
                position: position,
                ellipse: {
                    semiMajorAxis: radius,
                    semiMinorAxis: radius,
                    material: bufferColor,
                    outline: true,
                    outlineColor: Cesium.Color.LIGHTBLUE,
                    outlineWidth: 1,
                    height: properties.HIGH + 2.0,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            item.bufferEntity = bufferEntity;

            // 保存缓冲区信息用于后续连接
            bufferPoints.push({
                position: position,
                radius: radius,
                height: properties.HIGH
            });
        }
    });

    // 创建缓冲区之间的连接
    createConnections(viewer, bufferPoints);
}

// 加载GeoJSON数据
export function loadGeoJSONData(viewer, url) {
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            // 定义EPSG:32647坐标系统（UTM Zone 47N）
            proj4.defs("EPSG:32647", "+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs");

            // 移除CRS定义
            delete data.crs;

            // 清除现有的点实体
            pointEntities.forEach(entity => {
                viewer.entities.remove(entity.entity);
            });
            pointEntities.length = 0;

            // 为每个点创建实体
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    // 从EPSG:32647转换到WGS84
                    const [x, y] = feature.geometry.coordinates;
                    const [lon, lat] = proj4('EPSG:32647', 'EPSG:4326', [x, y]);
                    const height = feature.properties.HIGH || 0;

                    // 创建点实体
                    const entity = viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
                        point: {
                            pixelSize: pointSize,
                            color: defaultColor,
                            outlineColor: Cesium.Color.WHITE,
                            outlineWidth: 1,
                            heightReference: Cesium.HeightReference.CLAMP_TO_3D_MODEL,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY
                        },
                        properties: feature.properties
                    });

                    // 将实体和深度信息存储在数组中
                    pointEntities.push({
                        entity: entity,
                        depth: feature.properties.AVG_DEPTH || 0
                    });
                }
            });

            return pointEntities;
        });
}

// 创建颜色图例
export function createLegend(colorMap) {
    // 检查是否已存在图例
    let legend = document.getElementById('pointLegend');
    if (legend) {
        legend.remove();
    }

    // 创建图例容器
    legend = document.createElement('div');
    legend.id = 'pointLegend';
    legend.style.position = 'absolute';
    legend.style.bottom = '80px';
    legend.style.left = '20px';
    legend.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
    legend.style.color = 'white';
    legend.style.padding = '20px';
    legend.style.borderRadius = '10px';
    legend.style.fontFamily = 'Arial, sans-serif';
    legend.style.fontSize = '18px';
    legend.style.zIndex = '1000';
    legend.style.minWidth = '180px';
    legend.style.boxShadow = '0px 0px 10px rgba(0, 0, 0, 0.5)';

    // 创建图例标题
    const title = document.createElement('div');
    title.textContent = '积水距井口距离';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '15px';
    title.style.borderBottom = '2px solid white';
    title.style.paddingBottom = '10px';
    title.style.fontSize = '22px';
    title.style.textAlign = 'center';
    legend.appendChild(title);

    // 显示深度分级图例
    Object.keys(colorMap).forEach(levelName => {
        const item = document.createElement('div');
        item.style.marginTop = '12px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '12px';

        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '24px';
        colorBox.style.height = '24px';
        colorBox.style.marginRight = '15px';
        colorBox.style.border = '2px solid white';

        // 将Cesium颜色转换为CSS颜色
        const color = colorMap[levelName];
        const cssColor = `rgba(${Math.floor(color.red * 255)}, ${Math.floor(color.green * 255)}, ${Math.floor(color.blue * 255)}, ${color.alpha})`;
        colorBox.style.backgroundColor = cssColor;

        item.appendChild(colorBox);
        item.appendChild(document.createTextNode(levelName));
        legend.appendChild(item);
    });

    // 添加到文档
    document.body.appendChild(legend);
}

// 初始化节点积水情况显示功能
export function initNodeStatusDisplay(viewer) {
    const nodeStatusBtn = document.getElementById('NodeStatus');
    if (!nodeStatusBtn) return;

    // 初始化按钮状态
    nodeStatusBtn.setAttribute('data-status', 'inactive');

    nodeStatusBtn.addEventListener('click', function() {
        // 保存当前渲染模式设置
        const currentRenderMode = viewer.scene.requestRenderMode;

        if (nodeStatusBtn.getAttribute('data-status') === 'inactive') {
            // 激活分级显示
            pointEntities.forEach(item => {
                const outDepth = item.entity.properties.getValue().OUT_DEPTH;
                // 根据深度确定颜色
                let pointColor;
                if (outDepth < -0.5) {
                    pointColor = depthColorMap["大于0.5米"];
                } else if (outDepth >= -0.5 && outDepth < 0) {
                    pointColor = depthColorMap["0.5-0米"];
                } else {
                    pointColor = depthColorMap["已溢出"];
                }

                // 更新点颜色
                item.entity.point.color = pointColor;
            });

            // 创建分级图例
            createLegend(depthColorMap);

            // 更新按钮状态
            nodeStatusBtn.setAttribute('data-status', 'active');
            nodeStatusBtn.textContent = '恢复默认显示';
        } else {
            // 恢复统一蓝色
            pointEntities.forEach(item => {
                item.entity.point.color = defaultColor;
            });

            // 移除图例
            let legend = document.getElementById('pointLegend');
            if (legend) {
                legend.remove();
            }

            // 更新按钮状态
            nodeStatusBtn.setAttribute('data-status', 'inactive');
            nodeStatusBtn.textContent = '节点情况';
        }

        // 保持渲染设置与原来一致
        viewer.scene.requestRenderMode = currentRenderMode;

        // 强制重新渲染一次场景
        viewer.scene.requestRender();
    });
}

// 初始化节点溢流情况显示功能
export function initNodeOverflowDisplay(viewer) {
    const nodeOverflowBtn = document.getElementById('NodeOverflow');
    if (!nodeOverflowBtn) return;

    // 初始化按钮状态
    nodeOverflowBtn.setAttribute('data-status', 'inactive');

    nodeOverflowBtn.addEventListener('click', function() {
        if (nodeOverflowBtn.getAttribute('data-status') === 'inactive') {
            // 创建缓冲区
            createPointBuffer(viewer, pointEntities);
            
            // 更新按钮状态
            nodeOverflowBtn.setAttribute('data-status', 'active');
            nodeOverflowBtn.textContent = '隐藏溢流范围';

            // 强制刷新场景
            viewer.scene.requestRenderMode = false;
            viewer.scene.requestRender();
            setTimeout(() => {
                viewer.scene.requestRenderMode = true;
            }, 100);
        } else {
            // 清除缓冲区
            pointEntities.forEach(item => {
                if (item.bufferEntity) {
                    viewer.entities.remove(item.bufferEntity);
                    item.bufferEntity = null;
                }
            });
            
            // 清除连接区域
            clearConnections(viewer);
            
            // 更新按钮状态
            nodeOverflowBtn.setAttribute('data-status', 'inactive');
            nodeOverflowBtn.textContent = '溢流范围';

            // 强制刷新场景
            viewer.scene.requestRenderMode = false;
            viewer.scene.requestRender();
            setTimeout(() => {
                viewer.scene.requestRenderMode = true;
            }, 100);
        }
    });
} 