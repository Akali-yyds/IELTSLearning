from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "IELTSLearning API"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expires_minutes: int = 60
    refresh_token_expires_days: int = 7
    deepl_api_key: str = ""
    deepl_api_url: str = "https://api-free.deepl.com"
    # 百度翻译开放平台
    baidu_appid: str = ""
    baidu_secret_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()  # type: ignore[arg-type]

