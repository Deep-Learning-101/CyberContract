import os
import json
import schemas
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
if not API_KEY:
    # Fallback or error handling
    print("Warning: API_KEY not found in environment variables.")

genai.configure(api_key=API_KEY)

# Generation Config
generation_config = {
    "temperature": 0.1,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "response_mime_type": "application/json",
}

model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp", # Or gemini-1.5-flash
    generation_config=generation_config,
)

chat_model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",
    generation_config={"temperature": 0.5, "response_mime_type": "text/plain"}
)


def analyze_contract_content(pdf_path: str):
    """
    Analyzes the PDF contract and returns structured JSON data.
    """
    try:
        # Upload file to Gemini (File API) is more robust for large PDFs, 
        # but for simplicity and speed for smaller files, we can pass data inline if supported,
        # or use the File API. Let's use the File API for better practice with PDFs.
        
        # Note: 'upload_file' is synchronous in the python SDK
        sample_file = genai.upload_file(path=pdf_path, display_name="Contract PDF")
        
        prompt = """
        你是一位專業的法律合約分析助理。請分析這份合約文件，並提取以下關鍵資訊，以 JSON 格式輸出：
        {
            "summary": "合約目的的簡潔摘要，使用繁體中文。",
            "schedule": ["包含所有關鍵里程碑和對應日期的項目時程列表，使用繁體中文。"],
            "personnel": ["合約中提到的所有負責人員、職位或部門的列表，使用繁體中文。"],
            "paymentTerms": ["所有付款時程、金額和相關條件的列表，使用繁體中文。"]
        }
        """
        
        response = model.generate_content([sample_file, prompt])
        
        # Clean up file from Gemini storage? (Optional but good practice)
        # sample_file.delete() 
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Error analyzing contract: {e}")
        raise e

def chat_with_contract(context_data: dict, history: list, question: str):
    """
    Answers questions based on the extracted contract data.
    """
    try:
        # Construct context from extracted data
        context_str = f"""
        摘要: {context_data.get('summary')}
        時程: {', '.join(context_data.get('schedule', []))}
        相關人員: {', '.join(context_data.get('personnel', []))}
        付款條件: {', '.join(context_data.get('paymentTerms', []))}
        """
        
        system_instruction = f"""
        你是一位合約問答助理。這是一份已解析的合約內容：
        {context_str}
        
        請根據以上資訊，用繁體中文回答使用者的問題。
        你的回答應該要簡潔、直接，並且完全基於提供的合約內容。如果資訊不存在，請明確告知。
        """
        
        # Start chat session (or just generate content with history)
        # For stateless API, we construct the prompt with history
        
        messages = []
        # Add history if needed, but here we might just append previous Q&A to prompt 
        # or use the chat history object if we want to maintain session in DB
        
        full_prompt = f"{system_instruction}\n\n"
        for msg in history:
            role = "使用者" if msg['role'] == 'user' else "助理"
            full_prompt += f"{role}: {msg['content']}\n"
            
        full_prompt += f"使用者: {question}\n助理:"
        
        response = chat_model.generate_content(full_prompt)
        return response.text
        
    except Exception as e:
        print(f"Error in chat: {e}")
        raise e

def chat_with_multiple_contracts(contracts_data: list, question: str):
    """
    Answers questions based on multiple contracts.
    contracts_data: List of dicts, each containing 'title' and 'extracted_data'
    """
    try:
        context_str = ""
        for i, contract in enumerate(contracts_data):
            data = contract.get('extracted_data', {})
            context_str += f"""
            --- 合約 {i+1}: {contract.get('title')} ---
            摘要: {data.get('summary')}
            時程: {', '.join(data.get('schedule', []))}
            相關人員: {', '.join(data.get('personnel', []))}
            付款條件: {', '.join(data.get('paymentTerms', []))}
            ----------------------------------------
            """
        
        system_instruction = f"""
        你是一位跨合約分析助理。以下是多份合約的重點摘要：
        {context_str}
        
        請根據以上資訊，綜合分析並回答使用者的問題。
        如果問題涉及比較，請列出不同合約之間的差異。
        你的回答應該要簡潔、直接，並且完全基於提供的合約內容。
        """
        
        full_prompt = f"{system_instruction}\n\n使用者: {question}\n助理:"
        
        response = chat_model.generate_content(full_prompt)
        return response.text
        
    except Exception as e:
        print(f"Error in global chat: {e}")
        raise e
