unless ENV['RAILS_ENV'] == 'test'
  if defined?(::HTTPClient)
    class HTTPClient
      private
      alias_method :orig_do_get_block, :do_get_block

      def do_get_block(req, proxy, conn, &block)
        url = req.header.request_uri
        log_enabled = Binnacle::HttpLogger.allow?(url)

        uri = URI(url)
        url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

        retryable_response = nil
        bm = Benchmark.realtime do
          begin
            orig_do_get_block(req, proxy, conn, &block)
          rescue RetryableResponse => e
            retryable_response = e
          end
        end

        if log_enabled
          res = conn.pop
          headers = res.headers

          Binnacle::HttpLogger.signal(url_without_query, req.header.request_method, @host, @port, uri.path, uri.query, res.status_code, bm, headers, res.body, headers['Content-Encoding'], headers['Content-Type'])

          conn.push(res)
        end

        raise retryable_response if retryable_response != nil
      end

      class Session
        alias_method :orig_create_socket, :create_socket

        if self.instance_method(:create_socket).parameters == [[:req, :host], [:req, :port]]
          # httpclient-2.7.1 - def create_socket(host, port)
          def create_socket(host, port)
            if Binnacle::HttpLogger.allow?("#{host}:#{port}")
              @host = host
              @port = port
            end
            orig_create_socket(host, port)
          end
        else
          def create_socket(site)
            if Binnacle::HttpLogger.allow?("#{site.host}:#{site.port}")
              @host = site.host
              @port = site.port
            end
            orig_create_socket(site)
          end
        end
      end
    end
  end
else # TEST MODE - Adapt the Adapter...
  if defined?(::HTTPClient)
    require 'webmock'

    class WebMockHTTPClient
      alias_method :orig_do_get_block, :do_get_block

      def do_get_block(req, proxy, conn, &block)
        url = req.header.request_uri
        log_enabled = Binnacle::HttpLogger.allow?(url)
        return orig_do_get_block(req, proxy, conn, &block) unless log_enabled

        uri = URI(url)
        url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

        retryable_response = nil
        bm = Benchmark.realtime do
          begin
            orig_do_get_block(req, proxy, conn, &block)
          rescue RetryableResponse => e
            retryable_response = e
          end
        end

        res = conn.pop
        headers = res.headers

        Binnacle::HttpLogger.signal(url_without_query, req.header.request_method, uri.host, uri.port, uri.path, uri.query, res.status_code, bm, headers, res.body, headers['Content-Encoding'], headers['Content-Type'])
        conn.push(res)

        raise retryable_response if retryable_response != nil
      end
    end
  end
end
