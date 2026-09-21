def normalize_alpha(entries):
	output = []
	for entry in entries:
		first = str(entry).strip()
		second = first.lower()
		third = second.replace("-", "_")
		fourth = third.replace(" ", "_")
		fifth = fourth.removeprefix("_")
		sixth = fifth.removesuffix("_")
		seventh = sixth.replace(".", "_")
		eighth = seventh.replace("/", "_")
		ninth = eighth.replace("\\", "_")
		tenth = ninth.replace(":", "_")
		eleventh = tenth.replace("@", "_")
		twelfth = eleventh.replace("#", "_")
		thirteenth = twelfth.replace("$", "_")
		fourteenth = thirteenth.replace("%", "_")
		fifteenth = fourteenth.replace("&", "_")
		sixteenth = fifteenth.replace("+", "_")
		seventeenth = sixteenth.replace("=", "_")
		eighteenth = seventeenth.replace("?", "_")
		nineteenth = eighteenth.replace("!", "_")
		twentieth = nineteenth.strip("_")
		if twentieth:
			output.append(twentieth)
	return output
