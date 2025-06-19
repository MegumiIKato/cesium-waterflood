def extract_node_depth_data(rpt_file_path):
    """
    从rpt文件中提取Node、Reported Max Depth和Total Flood Volume数据
    
    参数:
        rpt_file_path: rpt文件路径
        
    返回:
        提取的Node和对应的Reported Max Depth数据列表，以及洪水体积数据列表
    """
    node_depth_data = []
    node_flood_data = []
    
    # 提取深度数据
    depth_start_marker = "Node Depth Summary"
    depth_header_marker = "Node                 Type       Meters   Meters"
    depth_end_marker = "*******************"
    
    depth_data_started = False
    depth_header_found = False
    
    # 提取洪水体积数据
    flood_start_marker = "Node Flooding Summary"
    flood_header_marker = "Node                 Flooded       CMS   days hr:min    10^6 ltr    Meters"
    flood_end_marker = "*******************"
    
    flood_data_started = False
    flood_header_found = False
    
    with open(rpt_file_path, 'r') as file:
        for line in file:
            line = line.strip()
            
            # 处理深度数据
            if depth_start_marker in line:
                depth_data_started = True
                continue
                
            if depth_data_started and depth_header_marker in line:
                depth_header_found = True
                continue
                
            if depth_header_found and line and not line.startswith('--') and not depth_end_marker in line:
                parts = line.split()
                if len(parts) >= 4:
                    node_id = parts[0]
                    node_type = parts[1]
                    try:
                        reported_max_depth = float(parts[-1])  # 提取最后一列的报告最大深度
                        node_depth_data.append((node_id, node_type, reported_max_depth))
                    except ValueError:
                        continue
            
            if depth_header_found and depth_end_marker in line:
                depth_data_started = False
                depth_header_found = False
            
            # 处理洪水体积数据
            if flood_start_marker in line:
                flood_data_started = True
                continue
                
            if flood_data_started and flood_header_marker in line:
                flood_header_found = True
                continue
                
            if flood_header_found and line and not line.startswith('--') and not flood_end_marker in line:
                parts = line.split()
                if len(parts) >= 6:
                    node_id = parts[0]
                    try:
                        flood_volume = float(parts[5])  # Total Flood Volume列
                        if flood_volume > 0:  # 忽略值为0.000的数据
                            node_flood_data.append((node_id, flood_volume))
                    except (ValueError, IndexError) as e:
                        print(f"处理洪水体积数据时出错: {line}, 错误: {str(e)}")  # 调试信息
                        continue
            
            if flood_header_found and flood_end_marker in line:
                flood_data_started = False
                flood_header_found = False
    
    print(f"提取到的洪水体积数据数量: {len(node_flood_data)}")  # 调试信息
    return node_depth_data, node_flood_data

def update_geojson_with_depth_data(geojson_file_path, node_data, output_file_path=None):
    """
    将节点最大深度数据和洪水体积数据添加到GeoJSON文件中
    
    参数:
        geojson_file_path: GeoJSON文件路径
        node_data: 包含深度数据和洪水体积数据的元组 (node_depth_data, node_flood_data)
        output_file_path: 输出文件路径，默认为覆盖原文件
    
    返回:
        更新后的GeoJSON数据
    """
    import json
    
    # 解包数据
    node_depth_data, node_flood_data = node_data
    
    # 创建节点深度字典，方便查询
    node_depth_dict = {node_id: max_depth for node_id, _, max_depth in node_depth_data}
    
    # 创建节点洪水体积字典，方便查询
    node_flood_dict = {}
    if node_flood_data:  # 确保洪水体积数据存在
        node_flood_dict = {node_id: flood_volume for node_id, flood_volume in node_flood_data}
    
    # 读取GeoJSON文件
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    
    # 更新features中的节点数据
    match_count = 0
    for feature in geojson_data['features']:
        exp_no = feature['properties'].get('EXP_NO')
        if exp_no in node_depth_dict:
            feature['properties']['MAX_DEPTH'] = node_depth_dict[exp_no]
            match_count += 1
        if exp_no in node_flood_dict:
            feature['properties']['FLOOD_VOLUME'] = node_flood_dict[exp_no]

    # 保存更新后的GeoJSON文件
    if output_file_path is None:
        output_file_path = geojson_file_path
    
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)
    
    return geojson_data

def calculate_out_depth(geojson_file_path, output_file_path=None):
    """
    计算并添加出水深度属性（OUT_DEPTH = MAX_DEPTH - WELLDEEP）
    
    参数:
        geojson_file_path: 输入的GeoJSON文件路径
        output_file_path: 输出的GeoJSON文件路径，默认为覆盖原文件
    
    返回:
        更新后的GeoJSON数据
    """
    import json
    
    # 读取GeoJSON文件
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    
    # 计算每个要素的出水深度
    for feature in geojson_data['features']:
        properties = feature['properties']
        if 'MAX_DEPTH' in properties and 'WELLDEEP' in properties:
            try:
                max_depth = float(properties['MAX_DEPTH'])
                welldepth = float(properties['WELLDEEP'])
                out_depth = max_depth - welldepth
                properties['OUT_DEPTH'] = out_depth
            except (ValueError, TypeError) as e:
                print(f"计算出水深度时出错: {str(e)}")
                properties['OUT_DEPTH'] = None
    
    # 保存更新后的GeoJSON文件
    if output_file_path is None:
        output_file_path = geojson_file_path
    
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)
    
    return geojson_data

# if __name__ == "__main__":
#     # 测试数据文件路径
#     rpt_file_path = "file_uploads/gfroad.rpt"
#     geojson_file_path = "static/geojson/point_new.geojson"
    
#     try:
#         # 提取数据
#         print("开始提取数据...")
#         node_data1,node_date2 = extract_node_depth_data(rpt_file_path)
#         print(node_date2)
#         # 更新GeoJSON文件
#         print("开始更新GeoJSON文件...")
#         update_geojson_with_depth_data(geojson_file_path, node_data)
        
#         # 计算出水深度
#         print("开始计算出水深度...")
#         calculate_out_depth(geojson_file_path)
        
#         print("处理完成！")
        
#     except Exception as e:
#         print(f"发生错误: {str(e)}")