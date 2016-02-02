if defined?(Ethon)
  require 'uri'

  module Ethon
    class Easy
      module Http
        alias_method :orig_http_request, :http_request
        def http_request(url, action_name, options = {})
          @binnacle_request_headers = options[:headers]
          @binnacle_backup_url = url

          @binnacle_action_name = action_name # remember this for compact logging
          @binnacle_request_headers = options[:headers]
          @binnacle_request_data = options[:body]

          orig_http_request(url, action_name, options)
        end
      end

      module Operations
        alias_method :orig_perform, :perform
        def perform
          _url = _url || @url || @binnacle_backup_url
          return orig_perform unless Binnacle::HttpLogger.allow?(_url)

          _response_code = nil
          bm = Benchmark.realtime do
            _response_code = orig_perform
          end

          uri = URI(_url)
          status   = response_headers.scan(/HTTP\/... (\d{3})/).flatten.first
          encoding = response_headers.scan(/Content-Encoding: (\S+)/).flatten.first
          content_type = response_headers.scan(/Content-Type: (\S+(; charset=\S+)?)/).flatten.first
          url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

          Binnacle::HttpLogger.signal(url_without_query, @binnacle_action_name, uri.host, uri.port, uri.path, uri.query, response_code, bm, @binnacle_request_headers, response_body, encoding, content_type, @binnacle_request_data)

          return_code
        end
      end
    end
  end
end
