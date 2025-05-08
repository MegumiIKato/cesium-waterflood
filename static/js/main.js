import { rain, stopRain } from '/static/js/raineffect.js';
import { loadGeoJSONData, initNodeStatusDisplay, initNodeOverflowDisplay } from '/static/js/geojsonLoad.js';

// 等待DOM加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {

    // 设置Cesium Ion访问令牌
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZDA3NzgyZi1hN2I4LTQ5OTItYmJlMS0yNzk3MTVkYjI0ZDUiLCJpZCI6MTIwMzcyLCJpYXQiOjE2NzI5MDA2ODN9.eiM100rpfWfXX_eQJ2Y3GjFgP6eR2H4L6GLLM2IUUwk';
    
    // 天地图密钥
    const tdtToken = '95478fb1c6e5ac392e34aa9389a83b81';

    // 创建天地图影像底图
    const tdtImgProvider = new Cesium.WebMapTileServiceImageryProvider({
        url: `http://t0.tianditu.gov.cn/img_w/wmts?tk=${tdtToken}`,
        layer: 'img',
        style: 'default',
        format: 'tiles',
        tileMatrixSetID: 'w',
        credit: new Cesium.Credit('天地图全球影像服务'),
        subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
        maximumLevel: 18
    });
    
    // 创建天地图影像注记底图
    const tdtImgMarkProvider = new Cesium.WebMapTileServiceImageryProvider({
        url: `http://t0.tianditu.gov.cn/cia_w/wmts?tk=${tdtToken}`,
        layer: 'cia',
        style: 'default',
        format: 'tiles',
        tileMatrixSetID: 'w',
        credit: new Cesium.Credit('天地图全球影像中文注记服务'),
        subdomains: ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'],
        maximumLevel: 18
    });
    
    // 创建Cesium查看器
    const viewer = new Cesium.Viewer('cesiumContainer', {
        // 配置查看器选项
        imageryProvider: tdtImgProvider, // 使用天地图影像作为底图
        terrainProvider: await Cesium.createWorldTerrainAsync({
            requestWaterMask: true,//请求水面掩膜。这会使得地形数据中的水体区域呈现得更真实。
            requestVertexNormals: true,//请求地形的顶点法线，这对于渲染光照和阴影效果非常重要
          }), // 使用全球地形
        animation: false, // 隐藏动画控件
        fullscreenButton: false, // 隐藏全屏按钮
        vrButton: false, // 隐藏VR按钮
        geocoder: true, // 显示地理编码器
        homeButton: false, // 隐藏Home按钮
        infoBox: false, // 隐藏信息框
        baseLayerPicker: false, // 隐藏图层选择器
        sceneModePicker: true, // 显示场景模式选择器
        selectionIndicator: false, // 隐藏选择指示器，避免与拖拽冲突
        timeline: false, // 隐藏时间线
        navigationHelpButton: false, // 隐藏导航帮助按钮
        scene3DOnly: false, // 允许2D和3D模式切换
        shouldAnimate: true, // 启用动画
        shadows: false, // 禁用阴影
        requestRenderMode: true, // 启用请求渲染模式，减少不必要的渲染
        maximumRenderTimeChange: Infinity, // 设置最大渲染时间变化
        sceneMode: Cesium.SceneMode.SCENE3D, // 设置为3D地球模式
        mapProjection: new Cesium.WebMercatorProjection() // 使用Web墨卡托投影
    });
    
    // 隐藏天地图影像底图
    // viewer.imageryLayers.get(0).show = false; 
    
    // 设置视图控制
    viewer.scene.screenSpaceCameraController.enableTilt = true; // 启用倾斜
    viewer.scene.screenSpaceCameraController.enableRotate = true; // 启用旋转
    
    // 隐藏左下角的Cesium Ion标志和归因信息
    viewer._cesiumWidget._creditContainer.style.display = "none";
    
    // 添加天地图影像注记图层
    // viewer.imageryLayers.addImageryProvider(tdtImgMarkProvider);
    
    // 禁用深度测试，使大气效果更明显
    viewer.scene.globe.depthTestAgainstTerrain = false;
    
    // 创建模型偏移矩阵
    // 参数说明：
    // 1. x方向平移（米）- 东西方向
    // 2. y方向平移（米）- 南北方向
    // 3. z方向平移（米）- 垂直方向
    const modelOffset = {
        x: 47.44,    // 向西偏移
        y: -20.28,     // 向北偏移
        z: 69.81       // 向下偏移
    };

    // 创建模型变换矩阵
    const modelMatrix = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(modelOffset.x, modelOffset.y, modelOffset.z)
    );

    // 创建GuangFuRoad 3DTiles数据
    const guangFuRoadTileset = new Cesium.Cesium3DTileset({
        url: '/static/GuangFuRoad/tileset.json',
        modelMatrix: modelMatrix, // 设置模型变换矩阵，用于偏移模型位置
        maximumScreenSpaceError: 16, // 最大屏幕空间误差，值越小模型越精细，但性能消耗越大
        maximumMemoryUsage: 6000, // 最大内存使用量（MB）
        dynamicScreenSpaceError: true, // 启用动态屏幕空间误差
        dynamicScreenSpaceErrorDensity: 0.00278, // 动态屏幕空间误差密度
        dynamicScreenSpaceErrorFactor: 4.0, // 动态屏幕空间误差因子
        dynamicScreenSpaceErrorHeightFalloff: 0.25, // 动态屏幕空间误差高度衰减
        skipLevelOfDetail: true, // 启用跳过细节级别
        baseScreenSpaceError: 1024, // 基础屏幕空间误差
        skipScreenSpaceErrorFactor: 16, // 跳过屏幕空间误差因子
        skipLevels: 1, // 跳过的级别数
        immediatelyLoadDesiredLevelOfDetail: false, // 不要立即加载所需的细节级别
        loadSiblings: false, // 不加载兄弟节点
        cullWithChildrenBounds: true, // 使用子节点边界进行剔除
        preloadWhenHidden: false, // 不在隐藏时预加载，减少内存使用
        preferLeaves: true, // 优先加载叶节点
        debugShowBoundingVolume: false, // 不显示边界体积
        debugShowContentBoundingVolume: false, // 不显示内容边界体积
        debugShowViewerRequestVolume: false, // 不显示查看器请求体积
        debugFreezeFrame: false, // 不冻结帧
    });

    // 添加tileset到场景
    viewer.scene.primitives.add(guangFuRoadTileset);
    
    // 初始化模型调整工具
    // initModelAdjuster(viewer, guangFuRoadTileset);
    
    // 启用视锥体裁剪 - 仅加载摄像机视野内的瓦片
    viewer.scene.globe.cullWithChildrenBounds = true;
    
    // 设置瓦片加载优化选项
    guangFuRoadTileset.cullRequestsWhileMoving = true; // 移动时暂停瓦片请求
    guangFuRoadTileset.cullRequestsWhileMovingMultiplier = 10; // 移动时的裁剪乘数
    guangFuRoadTileset.foveatedScreenSpaceError = true; // 启用中心区域优先加载
    guangFuRoadTileset.foveatedConeSize = 0.3; // 中心区域大小
    
    // 定期监控内存使用情况
    setInterval(function() {
        // 输出内存使用情况
        if (guangFuRoadTileset) {
            const memoryUsageMB = (guangFuRoadTileset.totalMemoryUsageInBytes / (1024 * 1024)).toFixed(2);
            const memoryLimitMB = guangFuRoadTileset.maximumMemoryUsage;
            
            console.log(`3D Tiles 内存使用情况: ${memoryUsageMB} MB / ${memoryLimitMB} MB`);
            
            // 当内存使用超过6000MB时，进行内存释放
            if (guangFuRoadTileset.totalMemoryUsageInBytes > 6000 * 1024 * 1024) {
                console.warn('内存使用超过6000MB，执行内存释放...');
                
                // 提高屏幕空间误差，减少瓦片细节
                const originalSSE = guangFuRoadTileset.maximumScreenSpaceError;
                guangFuRoadTileset.maximumScreenSpaceError = 64; // 临时设置为非常高的值
                
                // 强制卸载所有非必要瓦片
                guangFuRoadTileset.trimLoadedTiles();
                
                // 强制重新渲染场景
                viewer.scene.requestRender();
                
                // 恢复原始设置
                setTimeout(function() {
                    guangFuRoadTileset.maximumScreenSpaceError = originalSSE;
                    viewer.scene.requestRender();
                }, 3000); // 3秒后恢复
            }
        }
    }, 15000); // 每15秒执行一次
    
    // 添加摄像机移动开始事件监听器
    viewer.camera.moveStart.addEventListener(function() {
        // 摄像机开始移动时，可以临时提高屏幕空间误差以减少加载的瓦片数量
        guangFuRoadTileset.maximumScreenSpaceError = 32; // 移动时使用较大的误差值
        
        // 暂停瓦片请求，减少移动时的加载
        guangFuRoadTileset.cullRequestsWhileMoving = true;
    });
    
    // 添加摄像机移动结束事件监听器
    viewer.camera.moveEnd.addEventListener(function() {
        // 摄像机停止移动后，恢复正常的屏幕空间误差以提高质量
        guangFuRoadTileset.maximumScreenSpaceError = 16; // 静止时使用较小的误差值
        
        // 手动触发瓦片卸载和内存回收
        setTimeout(function() {
            // 手动触发瓦片卸载
            guangFuRoadTileset.trimLoadedTiles();
            
            // 清理未使用的资源
            viewer.scene.requestRender();
        }, 1000);
    });
    
    // 设置摄像机位置
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
            102.684693, // 经度
            24.987954,  // 纬度
            2116.44     // 高度
        ),
        orientation: {
            heading: Cesium.Math.toRadians(19.21), // 朝向
            pitch: Cesium.Math.toRadians(-42.75),  // 俯仰角
            roll: Cesium.Math.toRadians(0.00)      // 翻滚角
        }
    });

    // 加载GeoJSON数据
    loadGeoJSONData(viewer,'/static/geojson/point.geojson')
        .then(
            // 初始化节点积水情况显示功能
            initNodeStatusDisplay(viewer),
            // 初始化节点溢流情况显示功能
            initNodeOverflowDisplay(viewer)
        )
        .catch(error => {
            console.error('加载GeoJSON数据失败:', error);
        });
    
    initMousePositionPanel(); // 初始化鼠标位置信息面板

    // 添加降雨按钮事件监听
    const rainControlBtn = document.getElementById('RainControl');
    // 初始化雨效果状态
    rainControlBtn.setAttribute('data-status', 'inactive');
    
    // 定义一个变量跟踪是否需要持续渲染
    let needContinuousRendering = false;
    
    rainControlBtn.addEventListener('click', function() {
        if (rainControlBtn.getAttribute('data-status') === 'inactive') {
            // 开始降雨
            rain(viewer);
            rainControlBtn.textContent = '停止降雨效果';
            rainControlBtn.setAttribute('data-status', 'active');
            
            // 启用场景持续渲染，确保雨效果动画
            needContinuousRendering = true;
            viewer.scene.requestRenderMode = false;
            
            // 添加场景后处理事件监听，确保雨效果动画流畅
            if (!viewer._rainRenderLoop) {
                viewer._rainRenderLoop = true;
                viewer.scene.postRender.addEventListener(function() {
                    if (needContinuousRendering) {
                        viewer.scene.requestRender();
                    }
                });
            }
        } else {
            // 停止降雨
            stopRain(viewer);
            rainControlBtn.textContent = '显示降雨效果';
            rainControlBtn.setAttribute('data-status', 'inactive');
            
            // 恢复按需渲染模式，节省资源
            needContinuousRendering = false;
            viewer.scene.requestRenderMode = true;
        }
        
        // 无论开启还是关闭雨效果，都强制重新渲染一次
        viewer.scene.requestRender();
    });
    
    // 初始化鼠标位置信息面板
    function initMousePositionPanel() {
        // 获取显示元素
        const longitudeElement = document.getElementById('longitude');
        const latitudeElement = document.getElementById('latitude');
        const heightElement = document.getElementById('height');
        
        // 使用Cesium的实体选择事件处理器
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        
        // 使用节流函数减少频繁调用
        let lastUpdate = 0;
        const throttleDelay = 100; // 节流延迟时间（毫秒）
        
        // 添加鼠标移动事件监听
        handler.setInputAction(function(movement) {
            const now = Date.now();
            if (now - lastUpdate < throttleDelay) {
                return;
            }
            lastUpdate = now;
            
            // 使用Cesium的地形采样功能获取精确位置
            const ray = viewer.camera.getPickRay(movement.endPosition);
            if (!ray) return;
            
            // 尝试获取地形上的点
            const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            
            if (cartesian) {
                // 将笛卡尔坐标转换为地理坐标
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const longitudeDegrees = Cesium.Math.toDegrees(cartographic.longitude);
                const latitudeDegrees = Cesium.Math.toDegrees(cartographic.latitude);
                const heightValue = cartographic.height;
                
                // 更新显示
                longitudeElement.textContent = longitudeDegrees.toFixed(6);
                latitudeElement.textContent = latitudeDegrees.toFixed(6);
                heightElement.textContent = heightValue.toFixed(2);
            } else {
                // 如果没有击中地形，尝试获取椭球体上的点
                const cartesian = viewer.camera.pickEllipsoid(
                    movement.endPosition,
                    viewer.scene.globe.ellipsoid
                );
                
                if (cartesian) {
                    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    const longitudeDegrees = Cesium.Math.toDegrees(cartographic.longitude);
                    const latitudeDegrees = Cesium.Math.toDegrees(cartographic.latitude);
                    
                    // 更新经纬度显示
                    longitudeElement.textContent = longitudeDegrees.toFixed(6);
                    latitudeElement.textContent = latitudeDegrees.toFixed(6);
                    heightElement.textContent = '0.00'; // 椭球体表面高度为0
                } else {
                    // 如果都没有获取到，显示默认值
                    longitudeElement.textContent = '--';
                    latitudeElement.textContent = '--';
                    heightElement.textContent = '--';
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
    }
    
    // 将viewer对象暴露到全局作用域，以便其他脚本可以访问
    window.cesiumViewer = viewer;

    // // 初始化绘图工具
    // initDrawTools(viewer);

    // // 添加绘制矩形按钮事件监听
    // const drawRectangleBtn = document.getElementById('DrawRectangle');
    // drawRectangleBtn.addEventListener('click', function() {
    //     if (drawRectangleBtn.textContent === '开始绘制') {
    //         // 开始绘制矩形
    //         startDrawRectangle(viewer);
    //         drawRectangleBtn.textContent = '完成绘制';
    //     } else {
    //         // 停止绘制矩形
    //         stopDrawRectangle(viewer);
    //         drawRectangleBtn.textContent = '开始绘制';
    //     }
    // });

    console.log('Cesium初始化完成');

    // 添加SWMM模拟按钮事件监听
    const swmmControlBtn = document.getElementById('SWMMControl');
    const swmmModal = document.getElementById('swmmModal');
    const closeBtn = document.querySelector('.close');

    swmmControlBtn.addEventListener('click', function() {
        swmmModal.style.display = 'block';
    });

    closeBtn.addEventListener('click', function() {
        swmmModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === swmmModal) {
            swmmModal.style.display = 'none';
        }
    });
    
    // 获取按钮引用
    const loadResultBtn = document.getElementById('LoadResult');
    loadResultBtn.addEventListener('click', function() {
        loadResultBtn.textContent = '正在加载数据...';
        loadGeoJSONData(viewer, '/static/geojson/point_new.geojson')
        .then(() => {
            alert('加载模拟结果成功');
            loadResultBtn.textContent = '加载模拟结果';
        })
        .catch(error => {
            console.error('加载GeoJSON数据失败:', error);
        });
    });

});