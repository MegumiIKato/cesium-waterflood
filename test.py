def extract_node_depth_data(rpt_file_path):
    # 初始化存储节点积水深度和溢流的列表
    node_depth_data = []
    node_flood_data = []
    with open(rpt_file_path, 'r') as file:
        for line in file:
            line = line.strip()
            parts = line.split()        
            # 处理节点积水深度数据
            if len(parts) >= 4:
                node_id = parts[0]
                node_type = parts[1]
                try:
                    average_depth = float(parts[2])
                    node_depth_data.append((node_id, node_type, average_depth))
                except ValueError:
                    continue
            # 处理溢流数据
            if len(parts) >= 6:
                node_id = parts[0]
                try:
                    flood_volume = float(parts[5])
                    if flood_volume > 0:
                        node_flood_data.append((node_id, flood_volume))
                except (ValueError, IndexError):
                    continue
    return node_depth_data, node_flood_data

def update_geojson_with_depth_data(geojson_file_path, node_data, output_file_path=None):
    import json
    # 解包数据并创建查询字典
    node_depth_data, node_flood_data = node_data
    node_depth_dict = {node_id: average_depth for node_id, _, average_depth in node_depth_data}
    node_flood_dict = {node_id: flood_volume for node_id, flood_volume in node_flood_data}
    # 读取并更新GeoJSON数据
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    # 更新节点属性
    for feature in geojson_data['features']:
        exp_no = feature['properties'].get('EXP_NO')
        if exp_no in node_depth_dict:
            feature['properties']['AVG_DEPTH'] = node_depth_dict[exp_no]
        if exp_no in node_flood_dict:
            feature['properties']['FLOOD_VOLUME'] = node_flood_dict[exp_no]
    # 保存更新后的数据
    output_path = output_file_path or geojson_file_path
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)
    return geojson_data