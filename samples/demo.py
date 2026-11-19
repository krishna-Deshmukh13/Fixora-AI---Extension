# Fixora AI Python Demo File
# Issue 1: Bare except (catches SystemExit & KeyboardInterrupt)
try:
    risky_operation()
except:
    pass

# Issue 2: Mutable default argument
def append_item(item, basket=[]):
    basket.append(item)
    return basket
