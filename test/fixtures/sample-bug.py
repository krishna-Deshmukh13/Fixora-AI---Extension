# Sample Python file with deliberate bugs for Fixora AI testing

def append_to_list(item, target_list=[]):
    # BUG 1: Mutable default argument retains state across calls
    target_list.append(item)
    return target_list

def calculate_average(numbers):
    # BUG 2: ZeroDivisionError if list is empty
    total = sum(numbers)
    return total / len(numbers)

def find_user_by_email(email):
    # BUG 3: Undefined variable usage
    print(f"Searching for {user_email}")
    return None
