import re
import string

def clean_text(text):
    """
    Converts text to lowercase, removes all punctuation, 
    and strips leading/trailing whitespace.
    """
    if text is None:
        return ''
        
    # 1. Lowercase
    text = text.lower()
    
    # 2. Remove all punctuation using a translation table
    punctuation_remover = str.maketrans('', '', string.punctuation)
    text = text.translate(punctuation_remover)
    
    # 3. Strip leading/trailing whitespace
    return text.strip()


def clean_authors(text):
    # Extract all key-value pairs in their exact sequential order
    pairs = re.findall(r'([^|$]+)\$([^|]*)', text)
    
    authors = []
    current_record = {}
    
    for key, value in pairs:
        key_lower = key.lower()
        
        if key_lower in ('7', 'a', 'd'):
            # If we see a tag we already have, package the current record and reset
            if key_lower in current_record:
                author = (
                    current_record.get('7', ''), 
                    ', '.join([clean_text(current_record.get('a', '')), # Clean 'a' on export
                                clean_text(current_record.get('d', ''))] ) # Clean 'd' on export
                )
                authors.append(author)
                current_record = {}
            
            current_record[key_lower] = value
            
    # Save the last record remaining after the loop finishes
    if current_record:
        author = (
            current_record.get('7', ''), 
            ', '.join([clean_text(current_record.get('a', '')), 
                                clean_text(current_record.get('d', ''))] 
                    )
        )
        authors.append(author)
        
    return authors