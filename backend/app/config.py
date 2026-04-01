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
    # Tatoeba 例句
    tatoeba_api_url: str = "https://api.tatoeba.org"
    tatoeba_timeout_seconds: float = 8.0
    tatoeba_max_examples: int = 2
    tatoeba_query_scan_limit: int = 40
    tatoeba_db_path: str = "data/tatoeba_examples.db"
    tatoeba_sentences_en_url: str = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2"
    tatoeba_sentences_cmn_url: str = "https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2"
    tatoeba_links_eng_cmn_url: str = "https://downloads.tatoeba.org/exports/per_language/eng/eng-cmn_links.tsv.bz2"
    # Piper / eSpeak 发音
    piper_path: str = "piper"
    piper_data_dir: str = "data/piper_voices"
    piper_voice_en_us: str = "en_US-lessac-medium"
    piper_voice_en_gb: str = "en_GB-alan-medium"
    piper_model_en_us: str = ""
    piper_model_en_gb: str = ""
    piper_config_en_us: str = ""
    piper_config_en_gb: str = ""
    espeak_path: str = "espeak"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()  # type: ignore[arg-type]
