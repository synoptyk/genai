import os
import re

def is_matching_case(path, required_name):
    # Returns true if required_name exists in path exactly matching case
    if not os.path.exists(path):
        return False
    return required_name in os.listdir(path)

def check_file(filepath):
    errors = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find all imports: import ... from '...' or require('...')
    imports = re.findall(r"(?:import|require).*?['\"]([^'\"]+)['\"]", content)
    for imp in imports:
        if imp.startswith('.'):
            # Resolve relative path
            dirname = os.path.dirname(filepath)
            target = os.path.normpath(os.path.join(dirname, imp))
            
            # Since imports might omit extensions like .js or .jsx or /index.js
            target_dir = os.path.dirname(target)
            target_base = os.path.basename(target)
            
            if not os.path.exists(target_dir):
                errors.append(f"Directory {target_dir} does not exist (import {imp})")
                continue
                
            dir_contents = os.listdir(target_dir)
            
            # Check for exact case match
            match_found = False
            for ext in ['', '.js', '.jsx', '.ts', '.tsx']:
                if target_base + ext in dir_contents:
                    match_found = True
                    break
                    
            if not match_found:
                # Check if it resolves to a folder with an index
                if target_base in dir_contents and os.path.isdir(target):
                    index_found = False
                    sub_contents = os.listdir(target)
                    for ext in ['.js', '.jsx', '.ts', '.tsx']:
                        if 'index' + ext in sub_contents:
                            index_found = True
                            break
                    if index_found:
                        match_found = True
                        
                if not match_found:
                    # Look for case-insensitive match to guess what the user meant
                    real_name = next((n for n in dir_contents if n.lower() == target_base.lower() or n.lower().startswith(target_base.lower()+'.')), None)
                    if real_name:
                        errors.append(f"Case mismatch: imported '{imp}', actual file is '{real_name}'")
                    else:
                        errors.append(f"Could not resolve import '{imp}'")
                        
    return errors

for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, f)
            errs = check_file(filepath)
            if errs:
                print(f"File: {filepath}")
                for e in errs:
                    print("  -", e)
