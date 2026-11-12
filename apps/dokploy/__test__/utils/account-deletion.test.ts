import {
	checkDeletionCode,
	generateDeletionCode,
	serializeDeletionCode,
} from "@dokploy/server/services/account-deletion";
import { describe, expect, test } from "vitest";

describe("account deletion codes", () => {
	test("generates six-digit numeric codes", () => {
		for (let i = 0; i < 50; i++) {
			expect(generateDeletionCode()).toMatch(/^\d{6}$/);
		}
	});

	test("accepts the right code, ignoring surrounding whitespace", () => {
		const value = serializeDeletionCode("482913");

		expect(checkDeletionCode(value, "482913")).toEqual({
			valid: true,
			attempts: 0,
		});
		expect(checkDeletionCode(value, " 482913 ").valid).toBe(true);
	});

	test("counts failed attempts without revealing the hash", () => {
		const value = serializeDeletionCode("482913");

		const first = checkDeletionCode(value, "000000");
		expect(first.valid).toBe(false);
		if (first.valid) throw new Error("unreachable");
		expect(first.attempts).toBe(1);
		expect(JSON.parse(first.nextValue)).toEqual({
			...JSON.parse(value),
			attempts: 1,
		});

		const second = checkDeletionCode(first.nextValue, "999999");
		expect(second.valid).toBe(false);
		if (second.valid) throw new Error("unreachable");
		expect(second.attempts).toBe(2);

		expect(checkDeletionCode(second.nextValue, "482913")).toEqual({
			valid: true,
			attempts: 2,
		});
		expect(value).not.toContain("482913");
	});
});
