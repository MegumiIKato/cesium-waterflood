from flask import Flask, render_template, jsonify, request, send_from_directory
from pyswmm import Simulation
import os
import shutil
import time
from utils import extract_node_depth_data, update_geojson_with_depth_data, calculate_out_depth
import mimetypes

mimetypes.add_type('application/javascript', '.js')

app = Flask(__name__)

# 配置上传文件存储路径
UPLOAD_FOLDER = 'file_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/swmm', methods=['GET'])
def swmm_page():
    return render_template('swmm.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'swmm_file' not in request.files or 'rain_file' not in request.files:
        return jsonify({"error": "请上传所有必需的文件"}), 400
    
    swmm_file = request.files['swmm_file']
    rain_file = request.files['rain_file']
    
    if swmm_file.filename == '' or rain_file.filename == '':
        return jsonify({"error": "没有选择文件"}), 400
    
    if not (swmm_file.filename.endswith('.inp') and rain_file.filename.endswith('.dat')):
        return jsonify({"error": "文件格式不正确"}), 400
    
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
    except Exception as e:
        return jsonify({"error": f"文件上传失败: {str(e)}"}), 500

# SWMM模拟部分
@app.route('/run_swmm', methods=['GET'])
def run_swmm():
    try:
        # 获取最新上传的文件路径
        swmm_file_path = os.path.join(app.config['UPLOAD_FOLDER'], request.args.get('swmm_file'))
        print(f"开始处理文件: {swmm_file_path}")
        
        # 检查文件是否存在
        if not os.path.exists(swmm_file_path):
            return jsonify({
                "status": "error",
                "message": f"找不到SWMM文件: {swmm_file_path}"
            }), 404
        
        # 运行SWMM模拟
        sim = Simulation(swmm_file_path)
        try:
            sim.execute()
            print("SWMM模拟完成")
            
            # 检查是否生成了报告文件
            rpt_file = swmm_file_path.replace('.inp', '.rpt')
            out_file = swmm_file_path.replace('.inp', '.out')
            
            if not (os.path.exists(rpt_file) and os.path.exists(out_file)):
                return jsonify({
                    "status": "error",
                    "message": "模拟完成但未生成报告文件，请检查SWMM文件配置"
                }), 500
            
            # 提取节点深度数据
            node_data = extract_node_depth_data(rpt_file)
            
            if not node_data:
                return jsonify({
                    "status": "error",
                    "message": "无法从RPT文件提取节点深度数据"
                }), 500
            
            # 指定GeoJSON文件路径
            geojson_file_path = os.path.join("static", "geojson", "point.geojson")
            output_file_path = os.path.join("static", "geojson", "point_new.geojson")
            
            # 检查源文件是否存在
            if not os.path.exists(geojson_file_path):
                return jsonify({
                    "status": "error",
                    "message": f"找不到GeoJSON源文件: {geojson_file_path}"
                }), 404
                
            # 确保输出目录存在
            os.makedirs(os.path.dirname(output_file_path), exist_ok=True)
            
            # 更新GeoJSON文件
            try:
                updated_geojson = update_geojson_with_depth_data(geojson_file_path, node_data, output_file_path)
                calculate_out_depth(output_file_path)
                return jsonify({
                    "status": "success",
                    "message": "SWMM模拟完成并成功更新GeoJSON文件",
                    "rpt_file": os.path.basename(rpt_file),
                    "out_file": os.path.basename(out_file),
                    "nodes_count": len(node_data),
                    "updated_file": output_file_path
                })
            except Exception as e:
                return jsonify({
                    "status": "error",
                    "message": f"更新GeoJSON文件失败: {str(e)}"
                }), 500
            
        except Exception as e:
            print(f"SWMM模拟执行出错: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"SWMM模拟执行失败: {str(e)}"
            }), 500
        finally:
            sim.close()
            print("SWMM模拟已关闭")
    except Exception as e:
        print(f"模拟过程出错: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"模拟过程发生错误: {str(e)}"
        }), 500

# 下载模拟结果报告
@app.route('/simulation_result/<filename>')
def download_result(filename):
    try:
        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            filename,
            as_attachment=True
        )
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"下载失败: {str(e)}"
        }), 500

# 检查是否有可用的模拟结果
@app.route('/check_simulation_result', methods=['GET'])
def check_simulation_result():
    # 检查是否有rpt文件
    rpt_files = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) if f.endswith('.rpt')]
    
    if rpt_files:
        # 返回最新的rpt文件
        latest_rpt = max(rpt_files, key=lambda x: os.path.getmtime(os.path.join(app.config['UPLOAD_FOLDER'], x)))
        
        return jsonify({
            "status": "success",
            "has_result": True,
            "latest_result": latest_rpt
        })
    else:
        return jsonify({
            "status": "success",
            "has_result": False
        })

if __name__ == '__main__':
    app.run(debug=True)

