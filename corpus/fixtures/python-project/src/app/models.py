from .engine import build_model


def named_model(value):
	return build_model(value)
