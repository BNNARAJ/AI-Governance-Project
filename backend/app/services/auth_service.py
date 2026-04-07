import hashlib
import secrets
from typing import Optional, Dict
from pydantic import BaseModel
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    COMPLIANCE_OFFICER = "compliance_officer"
    AI_DEVELOPER = "ai_developer"

class User(BaseModel):
    username: str
    password_hash: str
    role: UserRole
    full_name: str

class AuthService:
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.sessions: Dict[str, str] = {}  # token -> username
        self._seed_default_users()

    def _seed_default_users(self):
        """Create default users for each role."""
        defaults = [
            ("admin", "admin123", UserRole.ADMIN, "System Administrator"),
            ("compliance", "compliance123", UserRole.COMPLIANCE_OFFICER, "Compliance Officer"),
            ("developer", "developer123", UserRole.AI_DEVELOPER, "AI Developer"),
        ]
        for username, password, role, name in defaults:
            self.users[username] = User(
                username=username,
                password_hash=self._hash(password),
                role=role,
                full_name=name
            )

    def _hash(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def login(self, username: str, password: str) -> Optional[Dict]:
        user = self.users.get(username)
        if not user or user.password_hash != self._hash(password):
            return None
        token = secrets.token_hex(32)
        self.sessions[token] = username
        return {"token": token, "username": username, "role": user.role, "full_name": user.full_name}

    def get_user(self, token: str) -> Optional[User]:
        username = self.sessions.get(token)
        if not username:
            return None
        return self.users.get(username)

    def require_role(self, token: str, required_roles: list) -> Optional[User]:
        user = self.get_user(token)
        if not user or user.role not in required_roles:
            return None
        return user

    def create_user(self, username: str, password: str, role: UserRole, full_name: str) -> bool:
        if username in self.users:
            return False
        self.users[username] = User(
            username=username,
            password_hash=self._hash(password),
            role=role,
            full_name=full_name
        )
        return True

    def list_users(self) -> list:
        return [{"username": u.username, "role": u.role, "full_name": u.full_name} for u in self.users.values()]

auth_service = AuthService()
