"""A deterministic Python fixture with deliberately visible control flow."""


def route_records(records, limit=100):
	"""Exercise the Python decision table used by the acceptance corpus."""
	total = 0
	for record in records:
		if record is None:
			continue
		if isinstance(record, dict) and record.get("enabled"):
			if record.get("value", 0) > limit or record.get("priority", 0) > 5:
				total += int(record.get("value", 0))
			else:
				total += 1
		elif isinstance(record, (int, float)):
			if record > 0:
				total += int(record)
		else:
			total -= 1
		try:
			if record == "retry":
				total += 2
		except (TypeError, ValueError):
			total -= 2
	values = [value * 2 for value in records if isinstance(value, (int, float)) and value > 0]
	match total:
		case 0:
			return values
		case int(value) if value > limit:
			return values + [value]
		case _:
			return values + [total]


def outer(value):
	"""Keep a nested function in the normalized function inventory."""
	def inner(item):
		if item and value:
			return item + value
		return value

	return inner(value)


class Router:
	def dispatch(self, record):
		if record is None:
			return None
		if isinstance(record, dict):
			return record.get("value")
		return str(record)

	@staticmethod
	def fallback(record):
		return record if record else "missing"
