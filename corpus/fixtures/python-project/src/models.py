class Model:
	def __init__(self, value):
		self.value = value

	def as_dict(self):
		return {"value": self.value}
