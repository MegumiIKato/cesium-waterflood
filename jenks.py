import jenkspy
from utils import extract_node_depth_data
import json

# rpt_file_path = "file_uploads/gfroad.rpt"
# geojson_file_path = "static/geojson/point_new.geojson"

# node_data1,node_data2 = extract_node_depth_data(rpt_file_path)

def get_formatted_breaks(breaks):
    """
    将断点数组格式化为字符串数组，格式如"0.001—0.256"
    
    参数:
        breaks: 断点数组，如 [0.001, 0.256, 0.982, 1.945]
        
    返回:
        格式化的字符串数组，如 ["0.001—0.256", "0.256—0.982", "0.982—1.945"]
    """
    formatted_breaks = []
    for i in range(len(breaks) - 1):
        formatted_breaks.append(f"{breaks[i]:.3f}—{breaks[i+1]:.3f}")
    
    return formatted_breaks

def runjenks(flood_data):
    """
    对洪水体积数据进行自然断点3分级
    
    参数:
        flood_data: 包含节点ID和洪水体积的元组列表，如 [('PSYS1272406', 0.001), ('PSYS1289764', 0.217)]
        
    返回:
        包含节点ID和对应分级的字典，如 {'PSYS1272406': 1, 'PSYS1289764': 2}
        以及断点数组
    """
    # 提取洪水体积数据（每个元组的第二个元素）
    values = [item[1] for item in flood_data]
    
    # 确保有足够的数据进行分级
    if len(values) < 3:
        print("数据点不足，无法进行3分级")
        return {}, []
    
    # 使用jenkspy进行自然断点3分级
    breaks = jenkspy.jenks_breaks(values, 3)
    print(f"自然断点分级结果: {breaks}")
    
    # 对每个数据点进行分类
    class_data = {}
    for node_id, value in flood_data:
        # 确定数据点所属的分级
        for i in range(1, len(breaks)):
            if value <= breaks[i]:
                class_data[node_id] = i  # 分级从1开始
                break
    
    return class_data, breaks

def updateclass(geojson_file_path, class_data):
    """
    将分级信息更新到geojson文件中
    
    参数:
        geojson_file_path: GeoJSON文件路径
        class_data: 包含节点ID和对应分级的字典，如 {'PSYS1272406': 1, 'PSYS1289764': 2}
    """
    # 读取GeoJSON文件
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    
    # 更新features中的节点数据
    update_count = 0
    for feature in geojson_data['features']:
        exp_no = feature['properties'].get('EXP_NO')
        if exp_no in class_data and 'FLOOD_VOLUME' in feature['properties']:
            # 添加class属性字段
            feature['properties']['class'] = class_data[exp_no]
            update_count += 1
    
    print(f"已更新{update_count}个节点的分级信息")
    
    # 保存更新后的GeoJSON文件
    with open(geojson_file_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)
    
    return geojson_data

# 主函数：执行洪水体积数据的自然断点分级并更新到GeoJSON文件
# if __name__ == "__main__":
#     # 打印洪水体积数据
#     print("洪水体积数据:")
#     for node_id, flood_volume in node_data2:
#         print(f"{node_id}: {flood_volume}")
    
#     # 对洪水体积数据进行自然断点3分级
#     class_data = runjenks(node_data2)
    
#     # 将分级信息更新到GeoJSON文件中
#     updateclass(geojson_file_path, class_data)
    
#     print("处理完成！")
