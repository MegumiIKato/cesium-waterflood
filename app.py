from flask import Flask, render_template, jsonify, request, send_from_directory
from pyswmm import Simulation
import os
import shutil
import time

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
            
            return jsonify({
                "status": "success",
                "message": "SWMM模拟完成",
                "rpt_file": os.path.basename(rpt_file),
                "out_file": os.path.basename(out_file)
            })
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

if __name__ == '__main__':
    app.run(debug=True)

