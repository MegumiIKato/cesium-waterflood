from pyswmm import Simulation
with Simulation('example.inp') as sim:
    for step in sim:
        pass

def extract_node_depth_data(rpt_file_path):
    node_data = []
    start_marker = "Node Depth Summary"
    header_marker = "Node                 Type       Meters   Meters"
    end_marker = "*******************"
    data_started = False
    header_found = False
    with open(rpt_file_path, 'r') as file:
        for line in file:
            line = line.strip()
            # 查找数据
            if start_marker in line:
                data_started = True
                continue
            if data_started and header_marker in line:
                header_found = True
                continue
            # 提取数据
            if header_found and line and not line.startswith('--') and not end_marker in line:
                parts = line.split()
                if len(parts) >= 4:
                    node_id = parts[0]
                    node_type = parts[1]
                    try:
                        average_depth = float(parts[2])
                        node_data.append((node_id, node_type, average_depth))
                    except ValueError:
                        continue
            if header_found and end_marker in line:
                break
    return node_data

def update_geojson_with_depth_data(geojson_file_path, node_depth_data, output_file_path=None):
    import json
    node_depth_dict = {node_id: average_depth for node_id, _, average_depth in node_depth_data}
    # 读取GeoJSON文件
    with open(geojson_file_path, 'r', encoding='utf-8') as file:
        geojson_data = json.load(file)
    # 更新数据
    match_count = 0
    for feature in geojson_data['features']:
        exp_no = feature['properties'].get('EXP_NO')
        if exp_no in node_depth_dict:
            feature['properties']['AVG_DEPTH'] = node_depth_dict[exp_no]
            match_count += 1  
    # 保存文件
    if output_file_path is None:
        output_file_path = geojson_file_path
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(geojson_data, file, ensure_ascii=False, indent=2)  
    return geojson_data

@app.route('/swmm', methods=['GET'])
def swmm_page():
    return render_template('swmm.html')
@app.route('/upload', methods=['POST'])
def upload_file():
    swmm_file = request.files['swmm_file']
    rain_file = request.files['rain_file']
    try:
        # 保存SWMM文件
        swmm_filename = swmm_file.filename
        swmm_file_path = os.path.join(app.config['UPLOAD_FOLDER'], swmm_filename)
        swmm_file.save(swmm_file_path)
        # 保存降雨文件
        rain_filename = rain_file.filename
        rain_file_path = os.path.join(app.config['UPLOAD_FOLDER'], rain_filename)
        rain_file.save(rain_file_path)
        return jsonify({
            "message": "文件上传成功",
            "swmm_file": swmm_filename,
            "rain_file": rain_filename
        })
# SWMM模拟部分
@app.route('/run_swmm', methods=['GET'])
def run_swmm():
    try:
        # 获取最新上传的文件路径
        swmm_file_path = os.path.join(app.config['UPLOAD_FOLDER'], request.args.get('swmm_file'))
        print(f"开始处理文件: {swmm_file_path}")
        # 运行SWMM模拟
        sim = Simulation(swmm_file_path)
        try:
            sim.execute()
            print("SWMM模拟完成")
            # 检查是否生成了报告文件
            rpt_file = swmm_file_path.replace('.inp', '.rpt')
            out_file = swmm_file_path.replace('.inp', '.out')
            return jsonify({
                "status": "success",
                "message": "SWMM模拟完成",
                "rpt_file": os.path.basename(rpt_file),
                "out_file": os.path.basename(out_file)
            })
        finally:
            sim.close()
            print("SWMM模拟已关闭")
    except Exception as e:
        print(f"模拟过程出错: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"模拟过程发生错误: {str(e)}"
        }), 500