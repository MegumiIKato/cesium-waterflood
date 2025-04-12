// 定义深度分级颜色
const depthColorMap = {
    "低于1米": Cesium.Color.GREEN.withAlpha(0.7),
    "1-2米": Cesium.Color.BLUE.withAlpha(0.7),
    "大于2米": Cesium.Color.RED.withAlpha(0.7)
};

// 定义统一点尺寸
const pointSize = 10;

// 默认蓝色
const defaultColor = Cesium.Color.BLUE.withAlpha(0.7);

// 缓冲区颜色
const bufferColor = Cesium.Color.LIGHTBLUE.withAlpha(0.3);

// 存储所有点实体的数组，以便后续更新
let pointEntities = [];

// 创建点缓冲区
export function createPointBuffer(viewer, pointEntities) {
    // 清除现有的缓冲区
    pointEntities.forEach(item => {
        if (item.bufferEntity) {
            viewer.entities.remove(item.bufferEntity);
        }
    });

    // 为每个点创建缓冲区
    pointEntities.forEach(item => {
        const position = item.entity.position.getValue();
        const bufferEntity = viewer.entities.add({
            position: position,
            ellipse: {
                semiMajorAxis: 10.0, // 1米半径
                semiMinorAxis: 10.0, // 1米半径
                material: bufferColor,
                outline: true,
                outlineColor: Cesium.Color.LIGHTBLUE,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_3D_MODEL,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        item.bufferEntity = bufferEntity;
    });
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
                            outlineWidth: 2,
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
    title.textContent = '积水深度';
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
                // 根据深度确定颜色
                let pointColor;
                if (item.depth < 1) {
                    pointColor = depthColorMap["低于1米"];
                } else if (item.depth >= 1 && item.depth <= 2) {
                    pointColor = depthColorMap["1-2米"];
                } else {
                    pointColor = depthColorMap["大于2米"];
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
            nodeStatusBtn.textContent = '节点积水情况';
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
            nodeOverflowBtn.textContent = '隐藏溢流区域';

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
            
            // 更新按钮状态
            nodeOverflowBtn.setAttribute('data-status', 'inactive');
            nodeOverflowBtn.textContent = '节点溢流情况';

            // 强制刷新场景
            viewer.scene.requestRenderMode = false;
            viewer.scene.requestRender();
            setTimeout(() => {
                viewer.scene.requestRenderMode = true;
            }, 100);
        }
    });
} 