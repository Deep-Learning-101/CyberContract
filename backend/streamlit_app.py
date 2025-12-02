import streamlit as st
import pandas as pd
import os
import sys
from sqlalchemy.orm import Session
from datetime import datetime
import time

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal
import models
from services import pdf_service, gemini_service

# Page Config
st.set_page_config(
    page_title="CyberContract - AI 合約分析神器",
    page_icon="📜",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize DB
models.Base.metadata.create_all(bind=engine)

# Helper functions
def get_session():
    return SessionLocal()

def save_uploaded_file(uploaded_file):
    try:
        file_path = os.path.join(pdf_service.UPLOAD_DIR, uploaded_file.name)
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        return file_path
    except Exception as e:
        st.error(f"Error saving file: {e}")
        return None

# Sidebar
with st.sidebar:
    st.title("📜 CyberContract")
    st.markdown("AI 智慧合約分析與管理系統")
    
    # File Upload
    st.subheader("上傳合約")
    uploaded_file = st.file_uploader("選擇 PDF 檔案", type="pdf")
    
    if uploaded_file is not None:
        if st.button("開始分析", type="primary"):
            with st.spinner("正在處理與分析合約..."):
                # 1. Save File
                file_path = save_uploaded_file(uploaded_file)
                
                if file_path:
                    # 2. DB Record
                    db = get_session()
                    new_contract = models.Contract(
                        title=uploaded_file.name,
                        filename=uploaded_file.name,
                        status="analyzing"
                    )
                    db.add(new_contract)
                    db.commit()
                    db.refresh(new_contract)
                    
                    # 3. Generate Thumbnail
                    pdf_service.generate_thumbnail(file_path, uploaded_file.name)
                    
                    # 4. Analyze
                    try:
                        extracted_data = gemini_service.analyze_contract_content(file_path)
                        new_contract.extracted_data = extracted_data
                        new_contract.status = "completed"
                        db.commit()
                        st.success(f"合約 {uploaded_file.name} 分析完成！")
                        time.sleep(1)
                        st.rerun()
                    except Exception as e:
                        new_contract.status = "error"
                        db.commit()
                        st.error(f"分析失敗: {e}")
                    finally:
                        db.close()

    st.divider()

    # Group Management
    st.subheader("群組管理")
    
    db = get_session()
    groups = db.query(models.Group).order_by(models.Group.created_at).all()
    
    # Create Group
    new_group_name = st.text_input("建立新群組", placeholder="輸入群組名稱...")
    if st.button("建立"):
        if new_group_name:
            new_group = models.Group(name=new_group_name)
            db.add(new_group)
            db.commit()
            st.success(f"群組 {new_group_name} 已建立")
            time.sleep(0.5)
            st.rerun()
            
    # Batch Management Button
    if st.button("📋 批次管理合約", use_container_width=True):
        st.session_state.selected_contract_id = "batch_manager"
        st.rerun()
            
    # Contract List
    st.subheader("合約列表")
    
    # Global Query Button
    if st.button("🔍 跨文件智慧查詢", use_container_width=True):
        st.session_state.selected_contract_id = "global"
        st.rerun()

    # Grouped Contracts
    # 1. Grouped
    for group in groups:
        with st.expander(f"📁 {group.name} ({len(group.contracts)})"):
            # Group Actions
            col1, col2 = st.columns([3, 1])
            with col2:
                if st.button("🗑️", key=f"del_grp_{group.id}", help="刪除群組"):
                    # Move contracts to null group
                    for c in group.contracts:
                        c.group_id = None
                    db.delete(group)
                    db.commit()
                    st.rerun()
            
            for contract in group.contracts:
                if st.button(f"📄 {contract.title}", key=f"c_{contract.id}"):
                    st.session_state.selected_contract_id = contract.id
                    st.rerun()

    # 2. Ungrouped
    ungrouped = db.query(models.Contract).filter(models.Contract.group_id == None).all()
    if ungrouped:
        with st.expander(f"📂 未分組 ({len(ungrouped)})", expanded=True):
            for contract in ungrouped:
                if st.button(f"📄 {contract.title}", key=f"c_{contract.id}"):
                    st.session_state.selected_contract_id = contract.id
                    st.rerun()
    
    db.close()

# Main Content
if "selected_contract_id" not in st.session_state:
    st.session_state.selected_contract_id = None

if st.session_state.selected_contract_id == "global":
    st.header("🔍 跨文件智慧查詢")
    
    db = get_session()
    completed_contracts = db.query(models.Contract).filter(models.Contract.status == "completed").all()
    
    if not completed_contracts:
        st.warning("目前沒有已完成分析的合約。")
    else:
        st.info(f"正在查詢 {len(completed_contracts)} 份合約...")
        
        # Chat Interface
        if "global_messages" not in st.session_state:
            st.session_state.global_messages = []

        for msg in st.session_state.global_messages:
            with st.chat_message(msg["role"]):
                st.write(msg["content"])

        if prompt := st.chat_input("請輸入您的問題..."):
            st.session_state.global_messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.write(prompt)

            with st.chat_message("ai"):
                with st.spinner("AI 正在思考中..."):
                    contracts_data = []
                    for c in completed_contracts:
                        if c.extracted_data:
                            contracts_data.append({
                                "title": c.title,
                                "extracted_data": c.extracted_data
                            })
                    
                    response = gemini_service.chat_with_multiple_contracts(contracts_data, prompt)
                    st.write(response)
                    st.session_state.global_messages.append({"role": "ai", "content": response})
    db.close()

elif st.session_state.selected_contract_id == "batch_manager":
    st.header("📋 批次合約管理")
    
    db = get_session()
    contracts = db.query(models.Contract).all()
    groups = db.query(models.Group).all()
    
    if not contracts:
        st.info("目前沒有合約可管理。")
    else:
        # Prepare Data
        group_map = {g.id: g.name for g in groups}
        group_map[None] = "未分組"
        
        # Reverse map for saving: Name -> ID
        group_name_to_id = {v: k for k, v in group_map.items()}
        
        # Create DataFrame
        data = []
        for c in contracts:
            data.append({
                "ID": c.id,
                "合約名稱": c.title,
                "目前群組": group_map.get(c.group_id, "未分組"),
                "狀態": c.status
            })
            
        df = pd.DataFrame(data)
        
        # Config Column
        group_options = list(group_name_to_id.keys())
        
        edited_df = st.data_editor(
            df,
            column_config={
                "ID": st.column_config.NumberColumn(disabled=True),
                "合約名稱": st.column_config.TextColumn(disabled=True),
                "狀態": st.column_config.TextColumn(disabled=True),
                "目前群組": st.column_config.SelectboxColumn(
                    "群組",
                    help="選擇合約所屬群組",
                    width="medium",
                    options=group_options,
                    required=True,
                )
            },
            hide_index=True,
            use_container_width=True,
            num_rows="fixed"
        )
        
        if st.button("💾 儲存變更", type="primary"):
            # Process changes
            updated_count = 0
            
            for index, row in edited_df.iterrows():
                contract_id = row["ID"]
                new_group_name = row["目前群組"]
                new_group_id = group_name_to_id.get(new_group_name)
                
                # Find original contract to check if changed
                # (Optimization: We could compare with original df, but direct DB update is safe enough for small scale)
                contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
                
                if contract and contract.group_id != new_group_id:
                    contract.group_id = new_group_id
                    updated_count += 1
            
            if updated_count > 0:
                db.commit()
                st.success(f"已更新 {updated_count} 份合約的群組設定！")
                time.sleep(1)
                st.rerun()
            else:
                st.info("沒有偵測到變更。")
                
    db.close()

elif st.session_state.selected_contract_id:
    db = get_session()
    contract = db.query(models.Contract).filter(models.Contract.id == st.session_state.selected_contract_id).first()
    
    if contract:
        st.header(f"📄 {contract.title}")
        
        # Toolbar
        col1, col2, col3 = st.columns([2, 2, 1])
        with col1:
            # Move to Group
            groups = db.query(models.Group).all()
            group_options = {g.id: g.name for g in groups}
            group_options[None] = "未分組"
            
            current_group = contract.group_id
            selected_group = st.selectbox(
                "移動至群組", 
                options=[None] + [g.id for g in groups],
                format_func=lambda x: group_options[x],
                index=([None] + [g.id for g in groups]).index(current_group) if current_group in ([None] + [g.id for g in groups]) else 0,
                key="move_group"
            )
            
            if selected_group != current_group:
                contract.group_id = selected_group
                db.commit()
                st.success("已移動群組")
                time.sleep(0.5)
                st.rerun()
                
        with col3:
            if st.button("刪除合約", type="primary"):
                # Delete files
                try:
                    if os.path.exists(os.path.join(pdf_service.UPLOAD_DIR, contract.filename)):
                        os.remove(os.path.join(pdf_service.UPLOAD_DIR, contract.filename))
                except:
                    pass
                db.delete(contract)
                db.commit()
                st.session_state.selected_contract_id = None
                st.rerun()

        # Tabs
        tab1, tab2 = st.tabs(["📊 分析結果", "💬 智能問答"])
        
        with tab1:
            if contract.status == "completed" and contract.extracted_data:
                data = contract.extracted_data
                
                st.subheader("📌 合約摘要")
                st.info(data.get("summary", "無摘要"))
                
                col_a, col_b = st.columns(2)
                with col_a:
                    st.subheader("📅 重要時程")
                    for item in data.get("schedule", []):
                        st.markdown(f"- {item}")
                        
                with col_b:
                    st.subheader("👥 相關人員")
                    for item in data.get("personnel", []):
                        st.markdown(f"- {item}")
                        
                st.subheader("💰 付款條件")
                for item in data.get("paymentTerms", []):
                    st.markdown(f"- {item}")
                    
            elif contract.status == "analyzing":
                st.warning("合約正在分析中，請稍候...")
            elif contract.status == "error":
                st.error("合約分析失敗。")

        with tab2:
            # Chat History
            history = db.query(models.ChatHistory).filter(models.ChatHistory.contract_id == contract.id).order_by(models.ChatHistory.timestamp).all()
            
            for msg in history:
                with st.chat_message(msg.role):
                    st.write(msg.content)
            
            if prompt := st.chat_input("問一些關於這份合約的問題..."):
                # User Message
                user_msg = models.ChatHistory(contract_id=contract.id, role="user", content=prompt)
                db.add(user_msg)
                db.commit()
                
                with st.chat_message("user"):
                    st.write(prompt)
                
                # AI Response
                with st.chat_message("ai"):
                    with st.spinner("AI 正在思考中..."):
                        # Get context
                        history_dicts = [{"role": h.role, "content": h.content} for h in history]
                        response = gemini_service.chat_with_contract(contract.extracted_data, history_dicts, prompt)
                        
                        st.write(response)
                        
                        # Save AI Message
                        ai_msg = models.ChatHistory(contract_id=contract.id, role="ai", content=response)
                        db.add(ai_msg)
                        db.commit()
                        
    else:
        st.error("找不到合約")
    db.close()

else:
    st.title("👋 歡迎使用 CyberContract")
    st.markdown("""
    請從左側選單上傳合約或選擇已分析的合約進行檢視。
    
    ### 功能特色
    - **自動分析**：上傳 PDF 自動提取關鍵資訊
    - **智能問答**：針對合約內容進行對話
    - **跨文件查詢**：同時查詢多份合約
    - **分組管理**：輕鬆管理您的合約文件
    """)
