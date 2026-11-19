"""
Fixora AI Sample Test File: Python
Demonstrates detection of mutable default arguments, bare except blocks,
and potential division-by-zero errors.
"""

import os
import sys

# Issue 1: Mutable default argument in Python function
def add_event(event_name, events_list=[]):
    events_list.append(event_name)
    return events_list

# Issue 2: Bare except block hiding critical exceptions
def calculate_ratio(total, count):
    try:
        # Issue 3: Potential ZeroDivisionError without input validation
        return total / count
    except:
        pass

# Issue 4: Insecure deserialization risk
import pickle

def load_user_session(serialized_data):
    # Security: Insecure pickle deserialization
    return pickle.loads(serialized_data)
