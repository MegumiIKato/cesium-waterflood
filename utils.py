def extract_node_depth_data(rpt_file_path):
    """
    从rpt文件中提取Node和AverageDepthMeters数据
    
    参数:
        rpt_file_path: rpt文件路径
        
    返回:
        提取的Node和对应的Average Depth数据列表
    """
    node_data = []
    start_marker = "Node Depth Summary"
    header_marker = "Node                 Type       Meters   Meters"
    end_marker = "*******************"
    
    data_started = False
    header_found = False
    
    with open(rpt_file_path, 'r') as file:
        for line in file:
            line = line.strip()
            
            # 查找摘要部分开始标记
            if start_marker in line:
                data_started = True
                continue
                
            # 找到表头，表示数据即将开始
            if data_started and header_marker in line:
                header_found = True
                continue
                
            # 如果已找到表头，且行不为空，且不是分隔线，则处理数据行
            if header_found and line and not line.startswith('--') and not end_marker in line:
                # 分割行数据并提取所需信息
                parts = line.split()
                if len(parts) >= 4:  # 确保有足够的列
                    node_id = parts[0]
                    node_type = parts[1]
                    # 确认数据行有效（不是表头等）
                    try:
                        average_depth = float(parts[2])
                        node_data.append((node_id, node_type, average_depth))
                    except ValueError:
                        # 如果无法将深度转换为浮点数，则跳过此行
                        continue
            
            # 检查是否到达摘要部分结束
            if header_found and end_marker in line:
                break
    
    return node_data

# def print_node_depth_data(data, sort_by_depth=False):
    """
    打印提取的节点深度数据
    
    参数:
        data: 节点深度数据列表，每项为(node_id, node_type, average_depth)元组
        sort_by_depth: 是否按深度排序，默认为False
    """
    if sort_by_depth:
        # 按平均深度降序排序
        data = sorted(data, key=lambda x: x[2], reverse=True)
    
    print("\n{:=^60}".format(" 节点深度数据 "))
    print("{:<15} {:<10} {:<15}".format("节点ID", "节点类型", "平均深度(米)"))
    print("-" * 60)
    
    for node_id, node_type, average_depth in data:
        print("{:<15} {:<10} {:<15.2f}".format(node_id, node_type, average_depth))
    
    # 打印统计信息
    if data:
        depths = [depth for _, _, depth in data]
        avg_depth = sum(depths) / len(depths)
        max_depth = max(depths)
        min_depth = min(depths)
        
        # 找出最大深度的节点
        max_depth_nodes = [node for node, _, depth in data if depth == max_depth]
        
        print("\n{:=^60}".format(" 统计信息 "))
        print(f"节点总数: {len(data)}")
        print(f"平均深度: {avg_depth:.2f} 米")
        print(f"最大深度: {max_depth:.2f} 米 (节点: {', '.join(max_depth_nodes)})")
        print(f"最小深度: {min_depth:.2f} 米")
        
        # 深度分布统计
        depth_ranges = [(0, 0.1), (0.1, 0.5), (0.5, 1), (1, 2), (2, 3), (3, float('inf'))]
        distribution = {f"{low}-{high if high != float('inf') else '以上'}米": 0 for low, high in depth_ranges}
        
        for _, _, depth in data:
            for (low, high) in depth_ranges:
                if low <= depth < high or (high == float('inf') and depth >= low):
                    distribution[f"{low}-{high if high != float('inf') else '以上'}米"] += 1
                    break
        
        print("\n深度分布:")
        for range_name, count in distribution.items():
            percentage = (count / len(data)) * 100
            print(f"{range_name}: {count} 个节点 ({percentage:.1f}%)")

def update_geojson_with_depth_data(geojson_file_path, node_depth_data, output_file_path=None):
    """
    将节点深度数据添加到GeoJSON文件中
    
    参数:
        geojson_file_path: GeoJSON文件路径
        node_depth_data: 节点深度数据列表，每项为(node_id, node_type, average_depth)元组
        output_file_path: 输出文件路径，默认为覆盖原文件
    
    返回:
        更新后的GeoJSON数据
    """
    import json
    
    # 创建节点深度字典，方便查询
    node_depth_dict = {node_id: average_depth for node_id, _, average_depth in node_depth_data}
    
    # 读取GeoJSON文件
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    
    # 更新features中的节点深度数据
    match_count = 0
    for feature in geojson_data['features']:
        exp_no = feature['properties'].get('EXP_NO')
        if exp_no in node_depth_dict:
            feature['properties']['AVG_DEPTH'] = node_depth_dict[exp_no]
            match_count += 1
    
    # 输出匹配统计
    # print(f"\n{match_count}个节点在GeoJSON文件中找到匹配并更新了深度数据")
    # print(f"GeoJSON中共有{len(geojson_data['features'])}个节点")
    # print(f"深度数据中共有{len(node_depth_data)}个节点")
    
    # 保存更新后的GeoJSON文件
    if output_file_path is None:
        output_file_path = geojson_file_path
    
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)
    
    # print(f"已保存更新后的GeoJSON文件到: {output_file_path}")
    
    return geojson_data

# 使用示例
# if __name__ == "__main__":
    # 替换为实际的rpt文件路径
    rpt_file_path = "file_uploads/gfroad.rpt"
    geojson_file_path = "static/geojson/point.geojson"
    output_file_path = "static/geojson/point_with_depth.geojson"  # 可选，如果想保留原文件
    
    # 提取节点深度数据
    node_data = extract_node_depth_data(rpt_file_path)
    
    # 打印节点深度数据
    print_node_depth_data(node_data)
    
    # 将深度数据添加到GeoJSON文件中
    updated_geojson = update_geojson_with_depth_data(geojson_file_path, node_data, output_file_path)
    
    # 打印按深度排序的数据
    print("\n\n按深度排序的结果:")
    print_node_depth_data(node_data, sort_by_depth=True)
