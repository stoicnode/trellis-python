from backend.src.branching import classify


def test_classify():
	assert classify(2) == "even"
