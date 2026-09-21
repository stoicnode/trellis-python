from src.app.engine import build_model


def test_build_model():
	assert build_model(1).value == 1
